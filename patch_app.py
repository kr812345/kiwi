import re

with open("apps/mobile/public/app.js", "r") as f:
    js = f.read()

# Replace the thinking and idle faces where they might exist
js = re.sub(r'kiwiAvatar\.textContent = .*?\[ \^ _ \^ \].*?;', "kiwiAvatar.textContent = '^_^';", js)
js = re.sub(r'kiwiAvatar\.textContent = .*?\[ • _ • \].*?;', "kiwiAvatar.textContent = '•_•';", js)
js = re.sub(r'kiwiAvatar\.textContent = .*?\[ x _ x \].*?;', "kiwiAvatar.textContent = 'x_x';", js)

# Wait, let's just make sure we are setting the idle face without brackets
js = js.replace("[ ^ _ ^ ]", "^_^")
js = js.replace("[ • _ • ]", "•_•")
js = js.replace("[ x _ x ]", "x_x")
js = js.replace("[ - _ - ]", "-_-")

# Now, let's inject some emotion detection into the form submission.
# We will look for chatForm.addEventListener('submit' ...
# Inside it, just before setting it to thinking, we can check the input value.
# Actually, the user asked: "if there is any emotion word in it, it will show that emotion"
# Let's add a function to `app.js` for this.

injection = """
const emotionMap = {
  'happy': '^ᴗ^',
  'excited': '★ᴗ★',
  'thinking': '•_•',
  'confused': 'ಠ_ಠ',
  'waiting': '-_-',
  'sad': 'T_T',
  'angry': '>_<',
  'shocked': 'O_O',
  'laughing': '^o^',
  'sleepy': '-ᴗ-',
  'error': 'x_x'
};

function detectEmotion(text) {
  const lowerText = text.toLowerCase();
  for (const [emotion, face] of Object.entries(emotionMap)) {
    if (lowerText.includes(emotion)) {
      return face;
    }
  }
  return null;
}
"""

if "const emotionMap" not in js:
    # insert after the variables
    js = js.replace("const kiwiAvatar = document.getElementById('kiwi-avatar');", "const kiwiAvatar = document.getElementById('kiwi-avatar');\n" + injection)


# Inside the submit event:
# const input = chatInput.value.trim();
# We can set the avatar to the detected emotion if found, otherwise let it go to thinking.
# But wait! If it's thinking, it will immediately override the emotion.
# The user said: "if there is any emotion word in it, it will show that emotion."
# Let's override the thinking face for that specific turn if an emotion is detected.

patch_submit = """
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    
    // Emotion detection
    const detectedFace = detectEmotion(input);
    if (detectedFace) {
      kiwiAvatar.className = 'avatar-face state-solved';
      kiwiAvatar.textContent = detectedFace;
    } else {
      kiwiAvatar.className = 'avatar-face state-thinking';
      kiwiAvatar.textContent = '•_•';
    }
"""

js = re.sub(r'chatInput\.value = '"''"';\s*chatInput\.style\.height = '"'auto'"';\s*sendBtn\.disabled = true;\s*kiwiAvatar\.className = '"'avatar-face state-thinking'"';\s*kiwiAvatar\.textContent = '"'•_•'"';', patch_submit, js)


with open("apps/mobile/public/app.js", "w") as f:
    f.write(js)
