// Server-side copy of the 36 statements + guna scoring map from js/questions.js.
// Duplicated (not imported) because js/questions.js is a browser global script,
// not a Node module. Keep the two in sync if the instrument ever changes.
export const QUESTIONS = [
  "I prefer living in the countryside to living in the city.",
  "I get very upset when things don't work out the way I wanted.",
  "I'm willing to bend the rules to reach my goals.",
  "I have little interest in spiritual matters or inner growth.",
  "I get angry easily.",
  "Fruits and vegetables are among my favorite foods.",
  "I tend to lack strong follow-through and determination.",
  "I am self-disciplined.",
  "I take my responsibilities and commitments seriously.",
  "I often feel dissatisfied with my life.",
  "I often feel taken advantage of in my close relationships.",
  "I stay fairly steady through life's ups and downs.",
  "I often criticize or put other people down.",
  "I often feel down or discouraged.",
  "I'm good at using willpower to reach my goals.",
  "I often neglect my responsibilities to my family.",
  "Cleanliness and order are very important to me.",
  "Personal and spiritual growth is very important to me.",
  "My mood is easily swayed by life's highs and lows.",
  "I often complain or grumble.",
  "I often feel low or depressed.",
  "I tend to put off or delay my responsibilities.",
  "No matter what I achieve or acquire, I keep wanting more.",
  "I greatly admire people who are materially successful.",
  "When I speak, I make a real effort not to upset others.",
  "I often feel envious of other people.",
  "My work is a frequent source of stress and anxiety.",
  "I get very excited and elated when things go my way.",
  "I enjoy rich, strongly flavored foods.",
  "I'm often dissatisfied with where I am in life and pushing to change it.",
  "Owning nice things is very important to me.",
  "When things get hard, I tend to give up.",
  "I'm honest and straightforward in my dealings with others.",
  "Things that are truly good for me are often difficult at first but rewarding later.",
  "I often neglect my responsibilities to my friends.",
  "I'm at my best in the morning and like to make the most of it by rising early."
];

// 1-based question numbers belonging to each mode (mirrors js/questions.js SCORING).
export const SCORING = {
  goodness:  [1, 6, 8, 9, 12, 15, 17, 18, 25, 33, 34, 36],
  passion:   [2, 3, 5, 13, 19, 20, 23, 24, 28, 29, 30, 31],
  ignorance: [4, 7, 10, 11, 14, 16, 21, 22, 26, 27, 32, 35]
};

export const SCALE_LABELS = [
  "", // unused — answers are 1-indexed
  "very strongly disagreed",
  "strongly disagreed",
  "somewhat disagreed",
  "felt neutral about",
  "somewhat agreed",
  "strongly agreed",
  "very strongly agreed"
];

export function modeOfQuestion(qNum) {
  if (SCORING.goodness.includes(qNum)) return "Sattva";
  if (SCORING.passion.includes(qNum)) return "Rajas";
  return "Tamas";
}
