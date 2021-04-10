export enum Modifier {
  Shift = 1,
  Alt = 2,
  Control = 4,
  Meta = 8,
}

function modifiersFromFlags(n: number): Modifier[] {
  const rv: Modifier[] = [];
  n -= 1;
  if (n & 8) rv.push(Modifier.Meta);
  if (n & 2) rv.push(Modifier.Alt);
  if (n & 1) rv.push(Modifier.Shift);
  if (n & 4) rv.push(Modifier.Control);
  return rv;
}

export enum KeyType {
  Normal,
  Function,
  PasteBegin,
  PasteEnd,
  Backspace,
  Up,
  Down,
  Left,
  Right,
  PageUp,
  PageDown,
  Insert,
  Delete,
  Home,
  End,
  Esc,
  Tab,
  Return,
}

export class Key {
  constructor(public modifiers: Modifier, public type: KeyType, public key: string = "") {
    // pass
  }

  static normal(modifiers: Modifier, key: string): Key {
    return new Key(modifiers, KeyType.Normal, key);
  }

  public equals(other: Key): boolean {
    return this.modifiers == other.modifiers && this.type == other.type && this.key == other.key;
  }

  toString(): string {
    const segments: string[] = [];
    if ((this.modifiers & (Modifier.Meta | Modifier.Alt)) != 0) segments.push("M");
    if (this.modifiers & Modifier.Shift) segments.push("S");
    if (this.modifiers & Modifier.Control) segments.push("C");

    switch (this.type) {
      case KeyType.Normal:
        segments.push(this.key);
        break;
      case KeyType.Function:
        segments.push(`F${this.key}`);
        break;
      case KeyType.PasteBegin:
        segments.push("Paste");
        break;
      case KeyType.PasteEnd:
        segments.push("/Paste");
        break;
      default:
        segments.push(KeyType[this.type]);
        break;
    }

    return segments.join("-");
  }
}

enum State {
  Normal, Esc, CSI, SS3
}

enum Ascii {
  BACKSPACE = 8,
  TAB = 9,
  CR = 13,
  ESC = 27,
  ZERO = "0".codePointAt(0) || 0,
  SEMICOLON = ";".codePointAt(0) || 0,
  O = "O".codePointAt(0) || 0,
  P = "P".codePointAt(0) || 0,
  S = "S".codePointAt(0) || 0,
  LBRACKET = "[".codePointAt(0) || 0,
  SQUIGGLE = "~".codePointAt(0) || 0,
  DEL = 127,
}

const ESC_TIMEOUT = 100;

// parse incoming xterm-encoded keypresses and emit decoded keys
export class KeyParser {
  state: State = State.Normal;
  modifiers: Modifier = 0;
  buffer = "";
  lastKey = Date.now();

  constructor(public emit: (keys: Key[]) => void) {
    // pass
  }

  feed(s: string) {
    const rv: Key[] = [];
    let checkMeta = false;
    for (let c of Array.from(s).map(s => s.codePointAt(0) || 0)) {
      checkMeta = this.feedCodepoint(c, rv);
    }
    this.lastKey = Date.now();
    if (rv.length > 0) this.emit(rv);

    if (checkMeta) {
      setTimeout(() => {
        if (Date.now() - this.lastKey >= ESC_TIMEOUT) {
          // dangling ESC, maybe it was just ESC...
          this.emit([ new Key(this.modifiers, KeyType.Esc) ]);
          this.state = State.Normal;
        }
      }, ESC_TIMEOUT);
    }
  }

  // returns true if it processed a dangling ESC
  feedCodepoint(c: number, rv: Key[]): boolean {
    switch (this.state) {
      case State.Normal:
        switch (c) {
          case Ascii.TAB:
            rv.push(new Key(this.modifiers, KeyType.Tab));
            this.modifiers = 0;
            return false;
          case Ascii.CR:
            rv.push(new Key(this.modifiers, KeyType.Return));
            this.modifiers = 0;
            return false;
          case Ascii.ESC:
            this.state = State.Esc;
            return true;
          case Ascii.BACKSPACE:
          case Ascii.DEL:
            rv.push(new Key(this.modifiers, KeyType.Backspace));
            this.modifiers = 0;
            return false;
          default:
            if (c < 32) {
              // control codes!
              this.modifiers |= Modifier.Control;
              c += 64;
            }
            rv.push(new Key(this.modifiers, KeyType.Normal, String.fromCodePoint(c)));
            this.modifiers = 0;
            return false;
        }

      case State.Esc:
        switch (c) {
          case Ascii.LBRACKET:
            this.state = State.CSI;
            this.buffer = "";
            return false;
          case Ascii.O:
            this.state = State.SS3;
            return false;
          default:
            // well crap. assume they meant meta.
            this.modifiers |= Modifier.Meta;
            this.state = State.Normal;
            return this.feedCodepoint(c, rv);
        }

      case State.CSI:
        if (c >= Ascii.ZERO && c <= Ascii.SEMICOLON) {
          this.buffer += String.fromCodePoint(c);
          return false;
        }
        this.parseCsi(rv, String.fromCodePoint(c), this.buffer.split(/[;:]/).map(s => parseInt(s, 10)));
        this.state = State.Normal;
        this.modifiers = 0;
        return false;

      case State.SS3:
        if (c >= Ascii.P && c <= Ascii.S) {
          rv.push(new Key(this.modifiers, KeyType.Function, (1 + c - Ascii.P).toString()));
          this.state = State.Normal;
          this.modifiers = 0;
          return false;
        } else {
          // what is ESC O (something)? we don't support it.
          rv.push(new Key(Modifier.Meta, KeyType.Normal, "O"));
          this.state = State.Normal;
          return this.feedCodepoint(c, rv);
        }
    }
  }

  parseCsi(rv: Key[], command: string, args: number[]) {
    if (args[0] == 1 && args.length >= 2) this.modifiers |= (args[1] - 1);

    switch (command) {
      case "A":
        rv.push(new Key(this.modifiers, KeyType.Up));
        break;
      case "B":
        rv.push(new Key(this.modifiers, KeyType.Down));
        break;
      case "C":
        rv.push(new Key(this.modifiers, KeyType.Right));
        break;
      case "D":
        rv.push(new Key(this.modifiers, KeyType.Left));
        break;
      case "H":
        rv.push(new Key(this.modifiers, KeyType.Home));
        break;
      case "F":
        rv.push(new Key(this.modifiers, KeyType.End));
        break;
      case "P":
        rv.push(new Key(this.modifiers, KeyType.Function, "1"));
        break;
      case "Q":
        rv.push(new Key(this.modifiers, KeyType.Function, "2"));
        break;
      case "R":
        rv.push(new Key(this.modifiers, KeyType.Function, "3"));
        break;
      case "S":
        rv.push(new Key(this.modifiers, KeyType.Function, "4"));
        break;
      case "Z":
        // xterm sends a special code for shift-tab!
        rv.push(new Key(Modifier.Shift, KeyType.Tab));
        break;
      case "~": {
        if (args.length > 1) this.modifiers = this.modifiers |= (args[1] - 1);
        switch (args[0] || 0) {
          case 1:
            rv.push(new Key(this.modifiers, KeyType.Home));
            break;
          case 2:
            rv.push(new Key(this.modifiers, KeyType.Insert));
            break;
          case 3:
            rv.push(new Key(this.modifiers, KeyType.Delete));
            break;
          case 4:
            rv.push(new Key(this.modifiers, KeyType.End));
            break;
          case 5:
            rv.push(new Key(this.modifiers, KeyType.PageUp));
            break;
          case 6:
            rv.push(new Key(this.modifiers, KeyType.PageDown));
            break;
          case 11:
            rv.push(new Key(this.modifiers, KeyType.Function, "1"));
            break;
          case 12:
            rv.push(new Key(this.modifiers, KeyType.Function, "2"));
            break;
          case 13:
            rv.push(new Key(this.modifiers, KeyType.Function, "3"));
            break;
          case 14:
            rv.push(new Key(this.modifiers, KeyType.Function, "4"));
            break;
          case 15:
            rv.push(new Key(this.modifiers, KeyType.Function, "5"));
            break;
          // what happened to 16?
          case 17:
            rv.push(new Key(this.modifiers, KeyType.Function, "6"));
            break;
          case 18:
            rv.push(new Key(this.modifiers, KeyType.Function, "7"));
            break;
          case 19:
            rv.push(new Key(this.modifiers, KeyType.Function, "8"));
            break;
          case 20:
            rv.push(new Key(this.modifiers, KeyType.Function, "9"));
            break;
          case 21:
            rv.push(new Key(this.modifiers, KeyType.Function, "10"));
            break;
          // what happened to 22?
          case 23:
            rv.push(new Key(this.modifiers, KeyType.Function, "11"));
            break;
          case 24:
            rv.push(new Key(this.modifiers, KeyType.Function, "12"));
            break;
          case 200:
            rv.push(new Key(this.modifiers, KeyType.PasteBegin));
            break;
          case 201:
            rv.push(new Key(this.modifiers, KeyType.PasteEnd));
            break;
        }
        break;
      }
      default:
        // well crap. CSI + garbage?
        rv.push(new Key(Modifier.Meta, KeyType.Normal, "["));
        rv.push(new Key(0, KeyType.Normal, command));
        break;
    }
  }
}
