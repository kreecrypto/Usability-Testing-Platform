import { defineConfig, devices } from '@playwright/test';
import trial from './playwright.trial.config';
export default defineConfig({...trial,testMatch:'ui-smoke.spec.ts',outputDir:'test-results/ui-smoke',projects:[{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]});
