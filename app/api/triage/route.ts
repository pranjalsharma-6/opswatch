import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    // Validate request
    const { logs } = await req.json()
    if (!logs?.trim()) {
      return NextResponse.json({ error: 'No logs provided' }, { status: 400 })
    }

    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
    }

    // Call Groq
    const completion = await client.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are a senior SRE/DevOps engineer. 
Your task is to analyze server logs and return a JSON object.
You must respond with ONLY a raw JSON object. 
Do not include any markdown, code blocks, backticks, or explanation.
Just the raw JSON object starting with { and ending with }.

Use exactly this structure:
{
  "severity": "critical",
  "title": "short title here",
  "root_cause": "one sentence root cause here",
  "impact": "one sentence impact here",
  "fix": "1. first step\n2. second step\n3. third step",
  "component": "component name here"
}

Severity must be exactly one of: critical, warning, info
- critical: full outage, data loss, cascading failure, security breach
- warning: degraded performance, partial failure, approaching limits  
- info: normal operations, successful events, scaling`
        },
        {
          role: 'user',
          content: `Logs to analyze:\n\n${logs}\n\nRespond with raw JSON only.`
        }
      ]
    })

    // Get raw response
    const raw = completion.choices[0]?.message?.content || ''
    console.log('Groq raw response:', raw)

    // Aggressively clean the response
    let cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^[^{]*/,'')     // remove anything before first {
      .replace(/[^}]*$/, '')    // remove anything after last }
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .trim()

    // Make sure it ends with }
    if (!cleaned.endsWith('}')) {
      cleaned = cleaned + '}'
    }

    console.log('Cleaned JSON:', cleaned)

    // Parse JSON
    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      // Last resort: try to extract with regex
      const match = raw.match(/\{[\s\S]*?\}/)
      if (match) {
        result = JSON.parse(match[0])
      } else {
        return NextResponse.json(
          { error: 'Could not parse AI response. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Ensure all fields exist
    const sanitized = {
      severity: ['critical', 'warning', 'info'].includes(result.severity)
        ? result.severity
        : 'info',
      title:      result.title      || 'Incident detected',
      root_cause: result.root_cause || 'Root cause under investigation',
      impact:     result.impact     || 'Impact assessment in progress',
      fix:        result.fix        || '1. Investigate logs\n2. Apply fix\n3. Monitor',
      component:  result.component  || 'Unknown component',
    }

    return NextResponse.json(sanitized)

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Triage API error:', msg)

    if (msg.includes('API key') || msg.includes('401')) {
      return NextResponse.json({ error: 'Invalid Groq API key — check Vercel env vars' }, { status: 401 })
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
      return NextResponse.json({ error: 'Rate limit hit — try again in a moment' }, { status: 429 })
    }
    if (msg.includes('model')) {
      return NextResponse.json({ error: 'Model unavailable — try again shortly' }, { status: 503 })
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}