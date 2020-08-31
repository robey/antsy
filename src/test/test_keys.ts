import { Key, KeyParser } from "../antsy/keys";

import "should";
import "source-map-support/register";

function keyParser(): { parser: KeyParser, output: Key[] } {
  const output: Key[] = [];
  const parser = new KeyParser(keys => keys.forEach(k => output.push(k)));
  return { parser, output };
}

function bundle(keys: Key[]): string {
  return keys.map(k => k.toString()).join(",");
}

describe("KeyParser", () => {
  it("handles ascii", () => {
    const { parser, output } = keyParser();
    parser.feed("hell");
    parser.feed("o");
    bundle(output).should.eql("h,e,l,l,o");
  });

  it("control codes", () => {
    const { parser, output } = keyParser();
    parser.feed("hell\u0001s\u0009\u0008\u000d\u007f");
    bundle(output).should.eql("h,e,l,l,C-A,s,Tab,Backspace,Return,Backspace");
  });

  it("meta codes", () => {
    const { parser, output } = keyParser();
    parser.feed("x\u001bc\u001b[y");
    bundle(output).should.eql("x,M-c,M-[,y");
  });

  it("arrows", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[A");
    parser.feed("\u001b");
    parser.feed("[C\u001b[");
    parser.feed("B\u001b[D");
    bundle(output).should.eql("Up,Right,Down,Left");
  });

  it("arrows with modifiers", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[1;2A");
    parser.feed("\u001b[1;5A");
    parser.feed("\u001b[1;6A");
    parser.feed("\u001b\u001b[1;2A");
    bundle(output).should.eql("S-Up,C-Up,S-C-Up,M-S-Up");
  });

  it("home/end", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[H\u001b[F\u001b[1~\u001b[4~");
    bundle(output).should.eql("Home,End,Home,End");
  });

  it("ins/del/pgup/pgdn", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[2~\u001b[3~\u001b[5~\u001b[6~");
    bundle(output).should.eql("Insert,Delete,PageUp,PageDown");
  });

  it("old f-keys", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001bOP\u001bOQ\u001bOR\u001bOS");
    bundle(output).should.eql("F1,F2,F3,F4");
  });

  it("new f-keys", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[11~\u001b[12~\u001b[13~\u001b[14~\u001b[15~");
    parser.feed("\u001b[17~\u001b[18~\u001b[19~\u001b[20~\u001b[21~");
    parser.feed("\u001b[23~\u001b[24~");
    bundle(output).should.eql("F1,F2,F3,F4,F5,F6,F7,F8,F9,F10,F11,F12");
  });

  it("f-keys with modifiers", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[11;2~\u001b[12;5~\u001b[13;6~\u001b[1;2P\u001b\u001b[1;5Q");
    bundle(output).should.eql("S-F1,C-F2,S-C-F3,S-F1,M-C-F2");
  });

  it("paste", () => {
    const { parser, output } = keyParser();
    parser.feed("\u001b[200~password\u001b[201~");
    bundle(output).should.eql("Paste,p,a,s,s,w,o,r,d,/Paste");
  });
});