// fancy CSI codes for updating a VT100/xterm terminal

const CSI = "\u001b[";

export class Terminal {
  static moveRelative(x: number, y: number): string {
    return (x == 0 ? "" : (x > 0 ? `${CSI}${x}C` : `${CSI}${-x}D`)) +
      (y == 0 ? "" : (y > 0 ? `${CSI}${y}B` : `${CSI}${-y}A`));
  }

  static move(x: number, y: number): string {
    if (x == 0) {
      if (y == 0) return `${CSI}H`;
      return `${CSI}${y + 1}H`;
    }
    return `${CSI}${y + 1};${x + 1}H`;
  }

  static clearScreen(): string { return `${CSI}2J${CSI}H`; }

  static eraseLine(): string { return `${CSI}K`; }

  static fg(index: number): string {
    if (index < 8) return `${CSI}3${index}m`;
    return `${CSI}38;5;${index}m`;
  }

  static bg(index: number): string {
    if (index < 8) return `${CSI}4${index}m`;
    return `${CSI}48;5;${index}m`;
  }
}
