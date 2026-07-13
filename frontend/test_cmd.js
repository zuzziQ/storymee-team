const text1 = "/start@StoryMeeBot";
const text2 = "/check_team@StoryMeeTeamBot";
const text3 = "@StoryMeeBot hello /start";

function normalize(text) {
  return text.replace(/^(\/[a-zA-Z0-9_]+)@[a-zA-Z0-9_]+/i, '$1').replace(/^@[a-zA-Z0-9_]+\s+/i, '').trim();
}

console.log(normalize(text1));
console.log(normalize(text2));
console.log(normalize(text3));
