/**
 * The curriculum. Single source of truth, served to the client by the
 * `getCatalogue` callable - the browser never hard-codes prompts, so lessons
 * can be changed by deploying functions only.
 */
export interface Lesson {
  id: string;
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  minutes: number;
  prompt: string;
  why: string;
  tips: string[];
  rubric: string[];
}

export interface Scenario {
  id: string;
  title: string;
  setting: string;
  personaName: string;
  personaRole: string;
  personality: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  openingLine: string;
  emoji: string;
}

export const LESSONS: Lesson[] = [
  {
    id: 'self-intro-30',
    title: 'The 30-second introduction',
    level: 'beginner',
    category: 'Interviews',
    minutes: 3,
    prompt:
      'Introduce yourself in about 30 seconds: your name, what you do, one thing you are good at, and one thing you want next.',
    why: 'Almost every interview, networking call and client meeting opens with this. A clean 30 seconds buys you credibility for everything after.',
    tips: [
      'Answer "who, what, and what next" - not your life story.',
      'End on something forward-looking, not a trailing "that\'s it".',
      'Say your job title slowly. It is the part people write down.'
    ],
    rubric: ['structure', 'pacing', 'clarity']
  },
  {
    id: 'star-answer',
    title: 'Answering with STAR',
    level: 'intermediate',
    category: 'Interviews',
    minutes: 5,
    prompt:
      'Tell me about a time you handled a difficult situation at work. Use Situation, Task, Action, Result - keep it under 90 seconds.',
    why: 'STAR stops you rambling. Interviewers score on structure as much as content.',
    tips: [
      'Spend 15 seconds on Situation and Task combined - the Action is the point.',
      'Put a number in the Result. "Cut turnaround from 5 days to 2".',
      'Say "I", not "we", when describing your own action.'
    ],
    rubric: ['structure', 'specificity', 'confidence']
  },
  {
    id: 'explain-simply',
    title: 'Explain it to a five-year-old',
    level: 'intermediate',
    category: 'Clarity',
    minutes: 4,
    prompt:
      'Explain something from your work to someone with no technical background, in under a minute. No jargon allowed.',
    why: 'Jargon is the fastest way to lose a room. This drill forces plain words.',
    tips: [
      'Ban every acronym for the first attempt.',
      'Use one analogy, not three.',
      'Check in: "does that make sense so far?"'
    ],
    rubric: ['clarity', 'vocabulary', 'pacing']
  },
  {
    id: 'filler-detox',
    title: 'Filler detox',
    level: 'beginner',
    category: 'Fluency',
    minutes: 3,
    prompt:
      'Speak for 45 seconds about your favourite meal. Every time you feel an "um" coming, pause silently instead.',
    why: 'Silence reads as composure. Fillers read as uncertainty. You need reps.',
    tips: [
      'A one-second pause is invisible to listeners.',
      'Slow your first sentence by 20% - it sets your whole pace.',
      'Breathe from the belly, not the throat.'
    ],
    rubric: ['fluency', 'pacing', 'confidence']
  },
  {
    id: 'pushback',
    title: 'Disagree without burning the bridge',
    level: 'advanced',
    category: 'Workplace',
    minutes: 5,
    prompt:
      'Your manager wants to ship a feature you think is a bad idea. Say no to the idea in 60 seconds, keeping the relationship intact.',
    why: 'Disagreement is the hardest register to get right: firm on the idea, warm on the person.',
    tips: [
      'Lead with the shared goal, then the concern.',
      'Attack the plan, never the person who proposed it.',
      'Always offer an alternative - a "no" without a "but here\'s what" is just obstruction.'
    ],
    rubric: ['structure', 'confidence', 'vocabulary']
  },
  {
    id: 'standup',
    title: 'The 45-second stand-up',
    level: 'beginner',
    category: 'Workplace',
    minutes: 3,
    prompt:
      'Give a status update: what you did yesterday, what you are doing today, and any blocker. Under 45 seconds.',
    why: 'Short, factual updates make you look organised. Long ones make people stop listening.',
    tips: [
      'Lead with the headline, then detail.',
      'Name the blocker explicitly - vague blockers never get solved.',
      'No apology, no preamble.'
    ],
    rubric: ['structure', 'clarity', 'pacing']
  },
  {
    id: 'cold-call',
    title: 'Opening a cold call',
    level: 'advanced',
    category: 'Sales',
    minutes: 5,
    prompt:
      'Open a call to a busy decision-maker. You have 20 seconds to earn another 40. Then handle one objection.',
    why: 'The first 20 seconds decide whether the rest of the call happens at all.',
    tips: [
      'Name the problem before the product.',
      'Give a reason for the call in one clause.',
      'Ask permission: "Is now a bad time?" works more often than it should.'
    ],
    rubric: ['structure', 'confidence', 'vocabulary']
  },
  {
    id: 'story-beat',
    title: 'Tell a story in three beats',
    level: 'intermediate',
    category: 'Storytelling',
    minutes: 4,
    prompt: 'Tell a 60-second story about something that went wrong and what you learned. Three beats only.',
    why: 'Stories stick. Three beats is the smallest structure that still lands.',
    tips: [
      'Beat one sets the stakes in a sentence.',
      'Beat two is the turn - the moment it broke.',
      'Beat three is what changed in you, not what you did.'
    ],
    rubric: ['structure', 'fluency', 'vocabulary']
  },
  {
    id: 'present-open',
    title: 'Opening a presentation',
    level: 'advanced',
    category: 'Presentations',
    minutes: 5,
    prompt:
      'Open a 10-minute presentation to a sceptical internal audience. Give the first 45 seconds only: hook, stakes, roadmap.',
    why: 'Most presenters spend their opening on housekeeping. You lose the room before the point.',
    tips: [
      'Start with the number or the question, never with "today I will talk about".',
      'State what the audience must decide or do.',
      'Keep the roadmap to one sentence.'
    ],
    rubric: ['structure', 'confidence', 'clarity']
  },
  {
    id: 'small-talk',
    title: 'Small talk that is not painful',
    level: 'beginner',
    category: 'Everyday',
    minutes: 3,
    prompt:
      'You are waiting with a colleague you barely know. Start a conversation for 40 seconds and hand the ball back to them.',
    why: 'Small talk is a skill with a shape: open wide, get specific, hand it back.',
    tips: [
      'Ask something specific and answerable - not "how are you".',
      'Follow up on their last three words.',
      'End your turn with a question, not a full stop.'
    ],
    rubric: ['fluency', 'vocabulary', 'confidence']
  }
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'interview-hiring-manager',
    title: 'Job interview - hiring manager',
    setting: 'A 30-minute first-round interview at a mid-sized company. You are the candidate.',
    personaName: 'Priya',
    personaRole: 'Hiring manager for the role you applied to',
    personality:
      'Warm but efficient. She has 12 more candidates this week. She likes specifics and gets visibly bored by vague answers.',
    goal: 'Convince her you can do the job by giving one concrete example with a number in it.',
    difficulty: 'intermediate',
    openingLine: 'Thanks for making the time. So - tell me a little about yourself, and why this role.',
    emoji: '💼'
  },
  {
    id: 'client-escalation',
    title: 'Angry client call',
    setting: 'A phone call with a client whose delivery is two weeks late.',
    personaName: 'Rahul',
    personaRole: 'Operations head at a client company',
    personality:
      'Frustrated and direct. He interrupts if you get defensive. He softens immediately if you acknowledge the problem without excuses.',
    goal: 'Calm him down, own the mistake without grovelling, and commit to a specific new date.',
    difficulty: 'advanced',
    openingLine: 'I have been chasing your team for a week. Where is my shipment?',
    emoji: '📞'
  },
  {
    id: 'salary-negotiation',
    title: 'Salary negotiation',
    setting: 'A call with a recruiter after you received an offer.',
    personaName: 'Meera',
    personaRole: 'Talent acquisition partner',
    personality:
      'Professional and practised. She deflects with "that is above band" but responds well to a clear, evidence-backed number.',
    goal: 'Ask for 20% more, justify it with market data and your results, and keep the offer alive.',
    difficulty: 'advanced',
    openingLine: 'Congratulations again! Did you get a chance to look at the offer letter?',
    emoji: '🤝'
  },
  {
    id: 'coffee-networking',
    title: 'Conference coffee queue',
    setting: 'A conference break. You are standing next to someone senior in your field.',
    personaName: 'Arjun',
    personaRole: 'Head of product at a company you admire',
    personality:
      'Friendly but distracted - he is checking his phone. He engages if you say something specific and interesting quickly.',
    goal: 'Introduce yourself in two sentences, find common ground, and ask for a 15-minute call.',
    difficulty: 'beginner',
    openingLine: 'That last talk ran long, didn\'t it?',
    emoji: '☕'
  },
  {
    id: 'team-conflict',
    title: 'Difficult teammate conversation',
    setting: 'A one-to-one with a teammate who keeps missing deadlines.',
    personaName: 'Sneha',
    personaRole: 'Your teammate of two years',
    personality:
      'Defensive at first, feels unsupported. She opens up if you ask questions instead of accusing.',
    goal: 'Raise the missed deadlines honestly without damaging the relationship, and agree on a fix.',
    difficulty: 'advanced',
    openingLine: 'Hey - you wanted to talk? I have a hard stop in ten minutes.',
    emoji: '🗣️'
  },
  {
    id: 'explain-to-exec',
    title: 'Presenting to an executive',
    setting: 'A 10-minute slot with a CXO who has read nothing you sent.',
    personaName: 'Vikram',
    personaRole: 'Chief operating officer',
    personality:
      'Impatient, numbers-driven. He cuts you off with "so what?" if you lead with process instead of outcome.',
    goal: 'Land the recommendation in the first 30 seconds and defend it under two "so what?" challenges.',
    difficulty: 'advanced',
    openingLine: 'I have eight minutes. What am I deciding today?',
    emoji: '📊'
  }
];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
