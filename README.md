# Antsy

Antsy is a simple library for letting you write text into a canvas, in up to 256 colors. When you're done, it will generate a list of strings with the ansi codes for your creation.

```javascript
var antsy = require("antsy");
var canvas = new antsy.Canvas(80, 24);
canvas.at(0, 23).backgroundColor("#00f").write("i am on a blue background!");

// now print it out!
canvas.toStrings().map(function (line) { console.log(line); });
```

That's all it does.

## xterm-256

All modern terminals support 256-color "xterm" control codes, so antsy uses them. There's an exhaustive explanation of the encoding in the docs/ folder.

Antsy uses an incredibly fast, state-of-the-art plutonic algorithm for determining the closest "xterm" color to a 24-bit web-style color code. You can use it yourself via the exported `get_color` function:

```javascript
var color = antsy.get_color("#ffffff"); // 15
```

It also understands the three-letter alternate forms ("f00") and a basic set of American color names ("teal", "brown", and so on).

## Canvas

Canvas builds a grid of color and text information. The following API lets you draw into it. Each function returns the Canvas object, so you can chain calls using a builder pattern.

You can set the foreground and/or background color to the special value `antsy.TRANSPARENT`, which will leave the previous color(s) alone when you write new text across old content.

- `new Canvas(width, height)` - Build a new canvas object of the given width and height (in character cells).

- `color(name)` - Set the current foreground color, by name (using the `get_color` function described above).

- `backgroundColor(name)` - Set the current background color, by name.

- `at(x, y)` - Move the cursor to the given coordinates, zero-based (x=0, y=0 is the upper left corner).

- `write(string)` - Write the string as a series of character cells in the current foreground and background colors, starting at the current cursor position. The cursor's x position moves with each character. If it reaches the end of a line, it will wrap around to the beginning of the next line. Similarly, wrapping off the bottom of the canvas will move back to the top.

- `fillBackground(colorName)` - Fill the canvas with spaces, using the given color as the background color. This is just a convenience method for clearing the canvas to a color.

- `toStrings()` - Return an array of strings which, if written to an ansi terminal, will draw the canvas. Each string is one line of the canvas, starting at line 0 (the top).
