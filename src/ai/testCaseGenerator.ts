import fs from 'fs';
import path from 'path';
import { PATHS, writeJson } from '../config';
import { AppModule, Priority, StructuredTestCase, TestCaseType } from '../types';
import { PluggableLlmClient } from './llmClient';

const VALID_MODULES: AppModule[] = [
  'Login',
  'MovieList',
  'MovieDetails',
  'Showtime',
  'SeatMap',
  'Payment',
  'Confirmation',
];
const VALID_PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
const VALID_TYPES: TestCaseType[] = ['positive', 'negative', 'boundary'];

function validateTestCaseSchema(tc: StructuredTestCase): string[] {
  const errors: string[] = [];
  if (!tc.id || typeof tc.id !== 'string') errors.push('Missing/invalid id');
  if (!tc.title || typeof tc.title !== 'string') errors.push('Missing/invalid title');
  if (!VALID_MODULES.includes(tc.module)) errors.push(`Invalid module: ${tc.module}`);
  if (!Array.isArray(tc.steps) || tc.steps.length === 0) errors.push('Steps must be a non-empty array');
  if (!tc.testData || typeof tc.testData !== 'object') errors.push('testData must be an object');
  if (!tc.expectedResult || typeof tc.expectedResult !== 'string') errors.push('Missing expectedResult');
  if (!VALID_PRIORITIES.includes(tc.priority)) errors.push(`Invalid priority: ${tc.priority}`);
  if (!VALID_TYPES.includes(tc.type)) errors.push(`Invalid type: ${tc.type}`);
  if (!tc.templateAction) errors.push('Missing templateAction');
  return errors;
}

export async function runTestCaseGenerator(): Promise<StructuredTestCase[]> {
  const client = new PluggableLlmClient();
  console.log(`[Module 1] Test Case Generator using LLM provider: ${client.activeProvider}`);

  const files = fs
    .readdirSync(PATHS.scenariosDir)
    .filter((f) => f.endsWith('.txt') || f.endsWith('.md'))
    .sort();

  const allTestCases: StructuredTestCase[] = [];

  for (const file of files) {
    const fullPath = path.join(PATHS.scenariosDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const generated = await client.generateTestCasesFromScenario(file, content);

    for (const tc of generated) {
      const schemaErrors = validateTestCaseSchema(tc);
      if (schemaErrors.length > 0) {
        console.warn(`[Module 1] Skipping invalid test case ${tc.id}: ${schemaErrors.join('; ')}`);
        continue;
      }
      allTestCases.push(tc);
    }
  }

  writeJson(PATHS.testcasesJson, {
    generatedAt: new Date().toISOString(),
    llmProvider: client.activeProvider,
    scenarioCount: files.length,
    testCaseCount: allTestCases.length,
    testCases: allTestCases,
  });

  console.log(
    `[Module 1] Generated ${allTestCases.length} schema-validated test cases from ${files.length} scenarios -> reports/testcases.json`
  );
  return allTestCases;
}

if (require.main === module) {
  runTestCaseGenerator().catch((err) => {
    console.error('[Module 1] Test case generation failed:', err);
    process.exit(1);
  });
}
