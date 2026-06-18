import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Ensure env.js exists before building to prevent build failures in environments like Vercel
const envPath = path.resolve('env.js')
if (!fs.existsSync(envPath)) {
  const examplePath = path.resolve('env.example.js')
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath)
    console.log('Created env.js from env.example.js for build safety.')
  } else {
    fs.writeFileSync(envPath, 'export const firebaseConfig = {};\n')
    console.log('Created dummy env.js for build safety.')
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})

