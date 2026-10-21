import { GET as getFeed } from './feed'

// Preserve the existing /feed endpoint while exposing a conventional .xml URL.
export async function GET() {
  return getFeed()
}
