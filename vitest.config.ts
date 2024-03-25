/// <reference types="vitest/globals" />

import { defineTestConfig } from '@fethcat/tests'
import { config } from 'dotenv'
import { join } from 'path'
import { defineConfig } from 'vitest/config'

config({ path: join(__dirname, 'tests', '.env.test') })

export default defineConfig({
  test: defineTestConfig({
    setupFiles: ['tests/setup.ts'],
  }),
})
