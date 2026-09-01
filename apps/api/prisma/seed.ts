import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const db = new PrismaClient();
const businesses = [
  {
    name: 'Puzzle Path',
    slug: 'puzzle-path',
    websiteUrl: 'https://www.puzzlepath.com.au',
    description: 'Scavenger hunts, tourism, local experiences and group activities.',
    industry: 'Tourism and local experiences',
    location: 'Gold Coast, Queensland',
    targetAudience:
      'Families, couples, tourists, schools and groups looking for memorable local activities.',
    productsServices: 'Self-guided scavenger hunts and local group experiences.',
    primaryGoal: 'Increase bookings',
    secondaryGoals: [
      'Increase organic search traffic',
      'Improve local SEO',
      'Create useful tourism and activity content',
      'Generate social media material',
      'Identify website improvements',
    ],
    brandTone: 'Friendly, adventurous and practical',
    keywords: ['scavenger hunts', 'Gold Coast activities', 'family activities', 'group activities'],
    mainCta: 'Book an experience',
  },
  {
    name: 'VitaePro',
    slug: 'vitaepro',
    websiteUrl: 'https://www.vitaepro.com.au',
    description: 'Job application, resume and cover-letter software.',
    industry: 'Career software',
    location: 'Australia',
    targetAudience: 'Australian job seekers who want clearer, stronger job applications.',
    productsServices: 'Resume, cover letter and job application software.',
    primaryGoal: 'Increase registrations',
    secondaryGoals: [
      'Increase organic search traffic',
      'Build career authority',
      'Create SEO-focused career content',
      'Generate social marketing material',
      'Identify website improvements',
    ],
    brandTone: 'Supportive, credible and clear',
    keywords: ['resumes', 'cover letters', 'job applications', 'career advice'],
    mainCta: 'Start building your application',
  },
];
async function main() {
  const email = 'demo@clickmarketingagent.local';
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo Owner',
      passwordHash: await argon2.hash('ChangeMe123!', { type: argon2.argon2id }),
    },
  });
  for (const item of businesses) {
    const business = await db.business.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        ...item,
        members: { create: { userId: user.id, role: 'OWNER' } },
        website: { create: { baseUrl: item.websiteUrl } },
        brandVoice: {
          create: {
            tone: item.brandTone,
            formality: 3,
            humourLevel: 2,
            preferredPhrases: [],
            prohibitedPhrases: [],
            targetCustomer: item.targetAudience,
            ctaStyle: item.mainCta,
            spellingStyle: 'Australian English',
            instructions:
              'Prefer helpful, specific language. Avoid exaggerated or unsupported claims.',
          },
        },
      },
    });
    await db.recommendation.createMany({
      skipDuplicates: true,
      data: [
        {
          businessId: business.id,
          source: 'ONBOARDING',
          category: 'Website',
          severity: 'OPPORTUNITY',
          title: 'Run the first website audit',
          description:
            'Crawl the site to establish a page inventory and identify measurable SEO improvements.',
        },
        {
          businessId: business.id,
          source: 'ONBOARDING',
          category: 'Content',
          severity: 'OPPORTUNITY',
          title: 'Create the first content draft',
          description:
            'Generate a draft using this business profile and brand voice, then review it before approval.',
        },
      ],
    });
  }
}
main().finally(() => db.$disconnect());
