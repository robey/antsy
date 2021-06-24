export enum Modifier {
  Shift = 1,
  Alt = 2,
  Control = 4,
  Meta = 8,
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
export class KeyParser implements AsyncIterator<Key>, AsyncIterable<Key> {
  state: State = State.Normal;
  modifiers: Modifier = 0;
  buffer = "";
  lastKey = Date.now();

  // async iterator state: queued keys or waiting reader
  queue: Key[] = [];
  resolve: ((value: IteratorResult<Key>) => void) | undefined;
  ended = false;

  receiver: ((key: Key) => Promise<void>) | undefined;
  receiverRunning = false;

  [Symbol.asyncIterator]() {
    return this;
  }

  next(): Promise<IteratorResult<Key>> {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.wake();
    });
  }

  // check if we should hand out keys to a waiting reader
  private wake() {
    if (this.receiver && !this.receiverRunning) {
      this.receiverRunning = true;
      setTimeout(async () => {
        while (this.queue.length > 0 && this.receiver) await this.receiver(this.queue.shift()!);
        this.receiverRunning = false;
      }, 0);
      return;
    }

    if (!this.resolve || (!this.ended && this.queue.length == 0)) return;
    const resolve = this.resolve;
    this.resolve = undefined;
    const value = this.queue.shift()!;
    resolve({ done: this.ended, value });
  }

  end() {
    this.ended = true;
    this.wake();
  }

  pipe(receiver: (key: Key) => Promise<void>) {
    this.receiver = receiver;
  }

  unpipe() {
    this.receiver = undefined;
  }

  feed(s: string) {
    let checkMeta = false;
    for (let c of Array.from(s).map(s => s.codePointAt(0) || 0)) {
      checkMeta = this.feedCodepoint(c);
    }
    this.lastKey = Date.now();
    this.wake();

    if (checkMeta) {
      setTimeout(() => {
        if (Date.now() - this.lastKey >= ESC_TIMEOUT) {
          // dangling ESC, maybe it was just ESC...
          this.queue.push(new Key(this.modifiers, KeyType.Esc));
          this.state = State.Normal;
          this.wake();
        }
      }, ESC_TIMEOUT);
    }
  }

  // returns true if it processed a dangling ESC
  feedCodepoint(c: number): boolean {
    switch (this.state) {
      case State.Normal:
        switch (c) {
          case Ascii.TAB:
            this.queue.push(new Key(this.modifiers, KeyType.Tab));
            this.modifiers = 0;
            return false;
          case Ascii.CR:
            this.queue.push(new Key(this.modifiers, KeyType.Return));
            this.modifiers = 0;
            return false;
          case Ascii.ESC:
            this.state = State.Esc;
            return true;
          case Ascii.BACKSPACE:
          case Ascii.DEL:
            this.queue.push(new Key(this.modifiers, KeyType.Backspace));
            this.modifiers = 0;
            return false;
          default:
            if (c < 32) {
              // control codes!
              this.modifiers |= Modifier.Control;
              c += 64;
            }
            this.queue.push(new Key(this.modifiers, KeyType.Normal, String.fromCodePoint(c)));
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
            return this.feedCodepoint(c);
        }

      case State.CSI:
        if (c >= Ascii.ZERO && c <= Ascii.SEMICOLON) {
          this.buffer += String.fromCodePoint(c);
          return false;
        }
        this.parseCsi(String.fromCodePoint(c), this.buffer.split(/[;:]/).map(s => parseInt(s, 10)));
        this.state = State.Normal;
        this.modifiers = 0;
        return false;

      case State.SS3:
        if (c >= Ascii.P && c <= Ascii.S) {
          this.queue.push(new Key(this.modifiers, KeyType.Function, (1 + c - Ascii.P).toString()));
          this.state = State.Normal;
          this.modifiers = 0;
          return false;
        } else {
          // what is ESC O (something)? we don't support it.
          this.queue.push(new Key(Modifier.Meta, KeyType.Normal, "O"));
          this.state = State.Normal;
          return this.feedCodepoint(c);
        }
    }
  }

  parseCsi(command: string, args: number[]) {
    if (args[0] == 1 && args.length >= 2) this.modifiers |= (args[1] - 1);

    switch (command) {
      case "A":
        this.queue.push(new Key(this.modifiers, KeyType.Up));
        break;
      case "B":
        this.queue.push(new Key(this.modifiers, KeyType.Down));
        break;
      case "C":
        this.queue.push(new Key(this.modifiers, KeyType.Right));
        break;
      case "D":
        this.queue.push(new Key(this.modifiers, KeyType.Left));
        break;
      case "H":
        this.queue.push(new Key(this.modifiers, KeyType.Home));
        break;
      case "F":
        this.queue.push(new Key(this.modifiers, KeyType.End));
        break;
      case "P":
        this.queue.push(new Key(this.modifiers, KeyType.Function, "1"));
        break;
      case "Q":
        this.queue.push(new Key(this.modifiers, KeyType.Function, "2"));
        break;
      case "R":
        this.queue.push(new Key(this.modifiers, KeyType.Function, "3"));
        break;
      case "S":
        this.queue.push(new Key(this.modifiers, KeyType.Function, "4"));
        break;
      case "Z":
        // xterm sends a special code for shift-tab!
        this.queue.push(new Key(Modifier.Shift, KeyType.Tab));
        break;
      case "~": {
        if (args.length > 1) this.modifiers = this.modifiers |= (args[1] - 1);
        switch (args[0] || 0) {
          case 1:
            this.queue.push(new Key(this.modifiers, KeyType.Home));
            break;
          case 2:
            this.queue.push(new Key(this.modifiers, KeyType.Insert));
            break;
          case 3:
            this.queue.push(new Key(this.modifiers, KeyType.Delete));
            break;
          case 4:
            this.queue.push(new Key(this.modifiers, KeyType.End));
            break;
          case 5:
            this.queue.push(new Key(this.modifiers, KeyType.PageUp));
            break;
          case 6:
            this.queue.push(new Key(this.modifiers, KeyType.PageDown));
            break;
          case 11:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "1"));
            break;
          case 12:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "2"));
            break;
          case 13:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "3"));
            break;
          case 14:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "4"));
            break;
          case 15:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "5"));
            break;
          // what happened to 16?
          case 17:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "6"));
            break;
          case 18:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "7"));
            break;
          case 19:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "8"));
            break;
          case 20:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "9"));
            break;
          case 21:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "10"));
            break;
          // what happened to 22?
          case 23:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "11"));
            break;
          case 24:
            this.queue.push(new Key(this.modifiers, KeyType.Function, "12"));
            break;
          case 200:
            this.queue.push(new Key(this.modifiers, KeyType.PasteBegin));
            break;
          case 201:
            this.queue.push(new Key(this.modifiers, KeyType.PasteEnd));
            break;
        }
        break;
      }
      default:
        // well crap. CSI + garbage?
        this.queue.push(new Key(Modifier.Meta, KeyType.Normal, "["));
        this.queue.push(new Key(0, KeyType.Normal, command));
        break;
    }
  }
}
