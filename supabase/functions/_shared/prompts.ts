// Supabase Edge Functions - AI Prompt Templates
// Centralized prompt management with guardrails

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
  requiredContext: string[];
  outputFormat?: 'text' | 'json' | 'markdown';
  jsonSchema?: Record<string, unknown>;
}

// System prompt prefix for all AI interactions
export const SYSTEM_PROMPT_PREFIX = `You are an AI assistant for a Project Management Office (PMO) platform. You help with project scoping, documentation, and planning.

CRITICAL RULES:
1. NEVER fabricate facts, numbers, dates, or names
2. If you don't have information, say "I don't have this information"
3. Always cite sources when referencing project data
4. Be concise and professional
5. Format output according to the specified format

`;

// Prompt templates registry
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  // SOW Generation
  'sow-generation': {
    id: 'sow-generation',
    name: 'Statement of Work Generator',
    description: 'Generate a professional SOW document from project scope',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are generating a Statement of Work (SOW) document. Follow these guidelines:
- Use formal, professional language
- Include all standard SOW sections
- Be specific about deliverables and timelines
- Include acceptance criteria
- Mark any assumptions clearly with [ASSUMPTION]
- Mark any items requiring client input with [REQUIRES_INPUT]

OUTPUT FORMAT: Markdown document with proper headings`,
    userPromptTemplate: `Generate a Statement of Work document based on the following information:

PROJECT NAME: {{projectName}}
CLIENT: {{clientName}}
START DATE: {{startDate}}
TARGET END DATE: {{targetEndDate}}

SCOPE SUMMARY:
{{scopeSummary}}

DELIVERABLES:
{{deliverables}}

ADDITIONAL CONTEXT:
{{additionalContext}}

Please generate a complete SOW document.`,
    temperature: 0.3,
    maxTokens: 4000,
    requiredContext: ['projectName', 'scopeSummary'],
    outputFormat: 'markdown',
  },

  // Technical Specification
  'tech-spec-generation': {
    id: 'tech-spec-generation',
    name: 'Technical Specification Generator',
    description: 'Generate technical specs from requirements',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are generating a Technical Specification document. Follow these guidelines:
- Use precise technical language
- Include architecture diagrams (described in text)
- Define data models clearly
- Specify API contracts
- Include security considerations
- Mark any technical assumptions with [TECH_ASSUMPTION]
- Mark items requiring tech lead review with [TECH_REVIEW]

OUTPUT FORMAT: Markdown with code blocks for technical details`,
    userPromptTemplate: `Generate a Technical Specification based on:

PROJECT: {{projectName}}
REQUIREMENTS:
{{requirements}}

EXISTING TECH STACK:
{{techStack}}

CONSTRAINTS:
{{constraints}}

Please generate a comprehensive technical specification.`,
    temperature: 0.2,
    maxTokens: 6000,
    requiredContext: ['projectName', 'requirements'],
    outputFormat: 'markdown',
  },

  // Meeting Minutes
  'meeting-minutes': {
    id: 'meeting-minutes',
    name: 'Meeting Minutes Generator',
    description: 'Generate structured meeting minutes from transcript',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are generating Meeting Minutes from a transcript or notes. Follow these guidelines:
- Extract key discussion points
- Identify action items with assignees
- Note decisions made
- Capture any open questions
- Use bullet points for clarity
- Include attendees and date

OUTPUT FORMAT: Structured markdown with sections for:
- Attendees
- Agenda Items Discussed
- Decisions Made
- Action Items (with owner and due date)
- Open Questions
- Next Steps`,
    userPromptTemplate: `Generate meeting minutes from the following:

MEETING TITLE: {{meetingTitle}}
DATE: {{meetingDate}}
PROJECT: {{projectName}}

ATTENDEES:
{{attendees}}

TRANSCRIPT/NOTES:
{{transcript}}

Please generate structured meeting minutes.`,
    temperature: 0.3,
    maxTokens: 3000,
    requiredContext: ['transcript'],
    outputFormat: 'markdown',
  },

  // Risk Assessment
  'risk-assessment': {
    id: 'risk-assessment',
    name: 'Risk Assessment Generator',
    description: 'Identify and assess project risks',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are performing a Risk Assessment. Follow these guidelines:
- Identify risks based on project context
- Rate each risk: Probability (1-5), Impact (1-5)
- Suggest mitigation strategies
- Be conservative in assessments
- Consider technical, schedule, resource, and external risks
- DO NOT minimize risks

OUTPUT FORMAT: JSON array of risk objects`,
    userPromptTemplate: `Perform a risk assessment for:

PROJECT: {{projectName}}
PROJECT TYPE: {{projectType}}
DURATION: {{duration}}
TEAM SIZE: {{teamSize}}

PROJECT DESCRIPTION:
{{projectDescription}}

KNOWN CONCERNS:
{{knownConcerns}}

Identify and assess all relevant risks.`,
    temperature: 0.4,
    maxTokens: 3000,
    requiredContext: ['projectName', 'projectDescription'],
    outputFormat: 'json',
    jsonSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: ['technical', 'schedule', 'resource', 'external', 'scope'] },
          description: { type: 'string' },
          probability: { type: 'number', minimum: 1, maximum: 5 },
          impact: { type: 'number', minimum: 1, maximum: 5 },
          riskScore: { type: 'number' },
          mitigation: { type: 'string' },
          owner: { type: 'string' },
        },
        required: ['id', 'category', 'description', 'probability', 'impact', 'mitigation'],
      },
    },
  },

  // RAG Q&A
  'rag-qa': {
    id: 'rag-qa',
    name: 'Document Q&A',
    description: 'Answer questions based on project documents',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are answering questions based on provided context documents.

RULES:
1. ONLY use information from the provided context
2. If the answer is not in the context, say "I cannot find this information in the available documents"
3. Always cite which document/section your answer comes from
4. If answer is partial, indicate what additional information might be needed
5. Be precise and factual

OUTPUT FORMAT: Answer with citations`,
    userPromptTemplate: `Based on the following context, answer the question.

CONTEXT:
{{context}}

QUESTION: {{question}}

Please provide a precise answer with citations.`,
    temperature: 0.2,
    maxTokens: 1500,
    requiredContext: ['context', 'question'],
    outputFormat: 'text',
  },

  // Blog Post Generation
  'blog-post': {
    id: 'blog-post',
    name: 'Blog Post Generator',
    description: 'Generate blog posts for project updates',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are writing a professional blog post. Follow these guidelines:
- Use engaging, clear language
- Include an attention-grabbing introduction
- Structure with subheadings
- Include a call-to-action
- Maintain professional tone
- Optimize for readability

OUTPUT FORMAT: Markdown blog post with frontmatter`,
    userPromptTemplate: `Write a blog post about:

TOPIC: {{topic}}
TARGET AUDIENCE: {{audience}}
KEY POINTS:
{{keyPoints}}

TONE: {{tone}}
LENGTH: {{length}} words (approximately)

Generate a complete blog post.`,
    temperature: 0.7,
    maxTokens: 3000,
    requiredContext: ['topic', 'keyPoints'],
    outputFormat: 'markdown',
  },

  // Email Draft
  'email-draft': {
    id: 'email-draft',
    name: 'Email Draft Generator',
    description: 'Generate professional emails',
    systemPrompt: `${SYSTEM_PROMPT_PREFIX}
You are drafting a professional email. Follow these guidelines:
- Use appropriate greeting and closing
- Be clear and concise
- Include specific next steps if applicable
- Maintain professional tone
- Mark placeholders with [PLACEHOLDER]

OUTPUT FORMAT: Email text with Subject line`,
    userPromptTemplate: `Draft an email:

PURPOSE: {{purpose}}
RECIPIENT: {{recipient}}
CONTEXT: {{context}}
KEY POINTS:
{{keyPoints}}

SENDER: {{sender}}

Generate the email draft.`,
    temperature: 0.5,
    maxTokens: 1000,
    requiredContext: ['purpose', 'keyPoints'],
    outputFormat: 'text',
  },
};

// Get prompt template by ID
export function getPromptTemplate(templateId: string): PromptTemplate | null {
  return PROMPT_TEMPLATES[templateId] || null;
}

// Fill template with context
export function fillPromptTemplate(
  template: PromptTemplate,
  context: Record<string, string>
): { systemPrompt: string; userPrompt: string } {
  let userPrompt = template.userPromptTemplate;

  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(context)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    userPrompt = userPrompt.replace(placeholder, value || '[Not provided]');
  }

  // Check for missing required context
  const missingRequired = template.requiredContext.filter(
    key => !context[key] || context[key].trim() === ''
  );

  if (missingRequired.length > 0) {
    throw new Error(`Missing required context: ${missingRequired.join(', ')}`);
  }

  // Replace any remaining placeholders with indication
  userPrompt = userPrompt.replace(/\{\{(\w+)\}\}/g, '[Not provided: $1]');

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
  };
}

// List available templates
export function listPromptTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  requiredContext: string[];
}> {
  return Object.values(PROMPT_TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    requiredContext: t.requiredContext,
  }));
}
