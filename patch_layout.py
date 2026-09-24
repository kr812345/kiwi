with open("apps/mobile/src/styles.css", "r") as f:
    css = f.read()

# Make #app-container position absolute
css = css.replace(
"""#app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overscroll-behavior-y: none;""",
"""#app-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh; /* fallback */
  overscroll-behavior-y: none;"""
)

with open("apps/mobile/src/styles.css", "w") as f:
    f.write(css)
