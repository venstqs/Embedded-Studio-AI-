/**
 * Turns an Arduino sketch (a beginner-sized subset of C++) into JavaScript
 * generator functions. Generators let delay() pause the sketch without
 * freezing the page: the simulator resumes it when enough time has passed.
 */

export class CompileError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

interface Tok { k: 'num' | 'str' | 'chr' | 'id' | 'p' | 'eof'; v: string; line: number; f?: boolean }

type Ty = string; // int, byte, char, bool, float, String, void, a class name, or any of those + '[]'
interface Ex { js: string; t: Ty; lv?: boolean; sz?: number }
interface Var { js: string; t: Ty; sz: number }
interface Fn { ret: Ty; params: { name: string; t: Ty; sz: number }[] }

const PUNCT = ['<<=', '>>=', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '->', '::'];
const CLASSES = ['Servo', 'LiquidCrystal_I2C', 'DHT'];
const INT_WORDS: Record<string, number> = {
  int: 2, long: 4, short: 2, unsigned: 2, signed: 2, word: 2, size_t: 2,
  uint16_t: 2, int16_t: 2, uint32_t: 4, int32_t: 4, int8_t: 1, uint64_t: 8, int64_t: 8,
};
const QUALIFIERS = ['const', 'static', 'volatile', 'PROGMEM', 'constexpr'];
const TYPE_WORDS = new Set([...Object.keys(INT_WORDS), 'byte', 'uint8_t', 'char', 'bool', 'boolean', 'float', 'double', 'void', 'String', ...CLASSES]);
const SIZE: Record<string, number> = { int: 2, byte: 1, char: 1, bool: 1, float: 4, String: 6 };

const CONSTANTS: Record<string, [string, Ty]> = {
  HIGH: ['1', 'int'], LOW: ['0', 'int'], INPUT: ['0', 'int'], OUTPUT: ['1', 'int'], INPUT_PULLUP: ['2', 'int'],
  true: ['true', 'bool'], false: ['false', 'bool'],
  PI: ['Math.PI', 'float'], DHT11: ['11', 'int'], DHT22: ['22', 'int'],
  DEC: ['10', 'int'], HEX: ['16', 'int'], OCT: ['8', 'int'], BIN: ['2', 'int'],
  A0: ['rt.A(0)', 'int'], A1: ['rt.A(1)', 'int'], A2: ['rt.A(2)', 'int'], A3: ['rt.A(3)', 'int'], A4: ['rt.A(4)', 'int'], A5: ['rt.A(5)', 'int'],
  LED_BUILTIN: ['rt.LED', 'int'], MSBFIRST: ['1', 'int'], LSBFIRST: ['0', 'int'],
};

const isInt = (t: Ty) => t === 'int' || t === 'byte' || t === 'char' || t === 'bool';
const isNum = (t: Ty) => isInt(t) || t === 'float';
const numTy = (...ts: Ty[]): Ty => (ts.includes('float') ? 'float' : 'int');

type Builtin = { ret: Ty | ((a: Ex[]) => Ty); js: (a: string[]) => string; min?: number };
const mathTy = (a: Ex[]) => numTy(...a.map(x => x.t));
const BUILTINS: Record<string, Builtin> = {
  pinMode: { ret: 'void', js: a => `rt.pm(${a[0]},${a[1]})`, min: 2 },
  digitalWrite: { ret: 'void', js: a => `rt.dw(${a[0]},${a[1]})`, min: 2 },
  digitalRead: { ret: 'int', js: a => `rt.dr(${a[0]})`, min: 1 },
  analogRead: { ret: 'int', js: a => `rt.ar(${a[0]})`, min: 1 },
  analogWrite: { ret: 'void', js: a => `rt.aw(${a[0]},${a[1]})`, min: 2 },
  delay: { ret: 'void', js: a => `(yield* rt.delay(${a[0]}))`, min: 1 },
  delayMicroseconds: { ret: 'void', js: a => `(yield* rt.delayUs(${a[0]}))`, min: 1 },
  millis: { ret: 'int', js: () => `rt.millis()` },
  micros: { ret: 'int', js: () => `rt.micros()` },
  pulseIn: { ret: 'int', js: a => `(yield* rt.pulseIn(${a.join(',')}))`, min: 2 },
  tone: { ret: 'void', js: a => `rt.tone(${a.join(',')})`, min: 2 },
  noTone: { ret: 'void', js: a => `rt.noTone(${a[0]})`, min: 1 },
  map: { ret: 'int', js: a => `rt.map(${a.join(',')})`, min: 5 },
  constrain: { ret: mathTy, js: a => `Math.min(Math.max(${a[0]},${a[1]}),${a[2]})`, min: 3 },
  min: { ret: mathTy, js: a => `Math.min(${a[0]},${a[1]})`, min: 2 },
  max: { ret: mathTy, js: a => `Math.max(${a[0]},${a[1]})`, min: 2 },
  abs: { ret: mathTy, js: a => `Math.abs(${a[0]})`, min: 1 },
  sq: { ret: mathTy, js: a => `((${a[0]})**2)`, min: 1 },
  pow: { ret: 'float', js: a => `Math.pow(${a[0]},${a[1]})`, min: 2 },
  sqrt: { ret: 'float', js: a => `Math.sqrt(${a[0]})`, min: 1 },
  sin: { ret: 'float', js: a => `Math.sin(${a[0]})`, min: 1 },
  cos: { ret: 'float', js: a => `Math.cos(${a[0]})`, min: 1 },
  tan: { ret: 'float', js: a => `Math.tan(${a[0]})`, min: 1 },
  round: { ret: 'int', js: a => `Math.round(${a[0]})`, min: 1 },
  floor: { ret: 'float', js: a => `Math.floor(${a[0]})`, min: 1 },
  ceil: { ret: 'float', js: a => `Math.ceil(${a[0]})`, min: 1 },
  isnan: { ret: 'bool', js: a => `Number.isNaN(${a[0]})`, min: 1 },
  random: { ret: 'int', js: a => `rt.random(${a.join(',')})`, min: 1 },
  randomSeed: { ret: 'void', js: () => `void 0` },
  bitRead: { ret: 'int', js: a => `(((${a[0]})>>(${a[1]}))&1)`, min: 2 },
};

const METHODS: Record<string, Record<string, Ty>> = {
  Serial: {
    begin: 'void', print: 'void', println: 'void', write: 'void', flush: 'void', available: 'int',
    read: 'int', peek: 'int', parseInt: 'int', parseFloat: 'float', readString: 'String', readStringUntil: 'String',
  },
  Servo: { attach: 'void', detach: 'void', write: 'void', writeMicroseconds: 'void', read: 'int', attached: 'bool' },
  LiquidCrystal_I2C: {
    init: 'void', begin: 'void', backlight: 'void', noBacklight: 'void', clear: 'void', home: 'void',
    setCursor: 'void', print: 'void', display: 'void', noDisplay: 'void', cursor: 'void', noCursor: 'void',
    blink: 'void', noBlink: 'void', write: 'void',
  },
  DHT: { begin: 'void', readTemperature: 'float', readHumidity: 'float' },
};

const UNSUPPORTED: Record<string, string> = {
  struct: 'Structs are not supported in this simulator yet.',
  class: 'Classes are not supported in this simulator yet.',
  attachInterrupt: 'Interrupts are not supported yet. Check the pin inside loop() instead.',
  goto: 'goto is not supported.',
  new: 'new is not supported. Declare your variables directly.',
};

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const macros = new Map<string, Tok[]>();
  let i = 0, line = 1;
  const n = src.length;
  const push = (t: Tok) => {
    const m = t.k === 'id' ? macros.get(t.v) : undefined;
    if (m) m.forEach(x => out.push({ ...x, line: t.line }));
    else out.push(t);
  };
  const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' };
  let lineStart = true;

  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; lineStart = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new CompileError('This /* comment is never closed with */', line);
      for (let j = i; j < end; j++) if (src[j] === '\n') line++;
      i = end + 2; continue;
    }
    if (c === '#' && lineStart) {
      let end = src.indexOf('\n', i);
      if (end < 0) end = n;
      const text = src.slice(i, end).replace(/\/\/.*$/, '');
      const def = /^#\s*define\s+(\w+)(\(?)\s*(.*)$/.exec(text);
      if (def) {
        if (def[2]) throw new CompileError(`Macros with arguments like ${def[1]}(...) are not supported. Write a function instead.`, line);
        const body = lex(def[3]).slice(0, -1).map(t => ({ ...t, line }));
        const expanded: Tok[] = [];
        body.forEach(t => { const m = t.k === 'id' ? macros.get(t.v) : undefined; if (m) expanded.push(...m); else expanded.push(t); });
        macros.set(def[1], expanded);
      }
      i = end; continue;
    }
    lineStart = false;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(src.slice(i, i + 40))!;
      let text = m[0];
      i += text.length;
      const isFloat = !/^0[xXbB]/.test(text) && /[.eE]/.test(text);
      let suffixFloat = false;
      while (i < n && /[uUlLfF]/.test(src[i])) { if (/[fF]/.test(src[i])) suffixFloat = true; i++; }
      if (/^0[bB]/.test(text)) text = String(parseInt(text.slice(2), 2));
      else if (!isFloat && !/^0[xX]/.test(text)) text = String(parseInt(text, 10));
      push({ k: 'num', v: text, line, f: isFloat || suffixFloat });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /\w/.test(src[j])) j++;
      push({ k: 'id', v: src.slice(i, j), line });
      i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\n') break;
        if (src[j] === '\\') { j++; s += escapes[src[j]] ?? src[j]; } else s += src[j];
        j++;
      }
      if (src[j] !== c) throw new CompileError(c === '"' ? 'This text is missing its closing " quote.' : "This character is missing its closing ' quote.", line);
      if (c === '"') {
        const prev = out[out.length - 1];
        if (prev && prev.k === 'str') prev.v += s; else push({ k: 'str', v: s, line });
      } else {
        if (s.length !== 1) throw new CompileError(`Single quotes hold exactly one character. Use double quotes for text: "${s}"`, line);
        push({ k: 'chr', v: String(s.charCodeAt(0)), line });
      }
      i = j + 1; continue;
    }
    const p = PUNCT.find(x => src.startsWith(x, i)) ?? c;
    if (!'+-*/%=<>!&|^~?:;,.(){}[]'.includes(p[0])) throw new CompileError(`I don't understand the character "${c}" here.`, line);
    push({ k: 'p', v: p, line });
    i += p.length;
  }
  out.push({ k: 'eof', v: '', line });
  return out;
}

class Parser {
  private toks: Tok[];
  private i = 0;
  private scopes: Map<string, Var>[] = [new Map()];
  private funcs = new Map<string, Fn>();
  private hoisted: string[] = [];
  private curFn: { name: string; ret: Ty } | null = null;
  private uid = 0;

  constructor(src: string) {
    this.toks = lex(src);
    this.scopes[0].set('Serial', { js: 'rt.Serial', t: 'Serial', sz: 0 });
  }

  // ---- token helpers ----
  private get t() { return this.toks[this.i]; }
  private peek(o = 1) { return this.toks[Math.min(this.i + o, this.toks.length - 1)]; }
  private is(v: string) { return this.t.v === v && (this.t.k === 'p' || this.t.k === 'id'); }
  private eat(v: string) { if (this.is(v)) { this.i++; return true; } return false; }
  private err(msg: string, line = this.t.line): never { throw new CompileError(msg, line); }
  private expect(v: string, after: string) {
    if (this.eat(v)) return;
    const prev = this.toks[Math.max(0, this.i - 1)];
    if (v === ';') this.err(`Missing ; ${after}`, prev.line);
    this.err(`Expected ${v} ${after}${this.t.k === 'eof' ? '' : `, but found "${this.t.v}"`}`, this.t.k === 'eof' ? prev.line : this.t.line);
  }
  private ident(what: string): string {
    if (this.t.k !== 'id') this.err(`Expected ${what}${this.t.k === 'eof' ? '' : `, but found "${this.t.v}"`}`);
    if (TYPE_WORDS.has(this.t.v) || CONSTANTS[this.t.v]) this.err(`"${this.t.v}" is a reserved word and can't be used as ${what}.`);
    return this.toks[this.i++].v;
  }

  // ---- types ----
  private typeAhead(): boolean {
    return this.t.k === 'id' && (TYPE_WORDS.has(this.t.v) || QUALIFIERS.includes(this.t.v));
  }

  private parseType(): { t: Ty; sz: number; isStatic: boolean } {
    let isStatic = false, base: Ty | null = null, sz = 2, unsigned = false, isConst = false;
    for (;;) {
      const v = this.t.v;
      if (this.t.k !== 'id') break;
      if (QUALIFIERS.includes(v)) { if (v === 'static') isStatic = true; if (v === 'const') isConst = true; this.i++; continue; }
      if (!TYPE_WORDS.has(v)) break;
      if (v === 'unsigned') unsigned = true;
      if (v in INT_WORDS) { if (base !== 'float') { base = base === 'char' ? 'char' : 'int'; sz = Math.max(v === 'unsigned' || v === 'signed' ? 0 : INT_WORDS[v], base === 'int' && sz !== 2 ? sz : 0) || 2; } }
      else if (v === 'byte' || v === 'uint8_t') { base = 'byte'; sz = 1; }
      else if (v === 'char') { base = 'char'; sz = 1; }
      else if (v === 'bool' || v === 'boolean') { base = 'bool'; sz = 1; }
      else if (v === 'float' || v === 'double') { base = 'float'; sz = 4; }
      else { base = v; sz = SIZE[v] ?? 2; }
      this.i++;
    }
    if (!base) this.err(`Expected a type like int or float, but found "${this.t.v}"`);
    if (base === 'char' && unsigned) base = 'byte';
    if (this.is('*')) {
      if (base !== 'char') this.err('Pointers (*) are not supported in this simulator yet.');
      this.i++; base = 'String'; sz = 6;
      while (QUALIFIERS.includes(this.t.v)) this.i++;
    }
    if (this.is('&')) {
      if (!isConst && base !== 'String') this.err('Reference parameters (&) are not supported yet. Return the value instead.');
      this.i++;
    }
    return { t: base, sz, isStatic };
  }

  // ---- scopes ----
  private lookup(name: string): Var | undefined {
    for (let s = this.scopes.length - 1; s >= 0; s--) { const v = this.scopes[s].get(name); if (v) return v; }
    return undefined;
  }
  private defineVar(name: string, t: Ty, sz: number, line: number, js = `$${name}`): Var {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) this.err(`"${name}" is already declared here. Each variable needs its own name.`, line);
    const v = { js, t, sz };
    scope.set(name, v);
    return v;
  }

  private coerce(to: Ty, e: Ex, line: number): string {
    if (to === e.t && to !== 'byte') return e.js;
    if (to.endsWith('[]') || e.t.endsWith('[]')) { if (to === e.t) return e.js; this.err(`Can't use a ${this.tyName(e.t)} where a ${this.tyName(to)} is needed.`, line); }
    if (to === 'String') {
      if (e.t === 'char') return `String.fromCharCode(${e.js})`;
      if (isNum(e.t)) return `rt.str(${e.js},'${e.t}')`;
      this.err(`Can't turn a ${this.tyName(e.t)} into text.`, line);
    }
    if (!isNum(e.t)) {
      if (e.t === 'String' && isNum(to)) this.err(`Can't store text in a ${this.tyName(to)}. Use .toInt() or .toFloat() to convert it.`, line);
      if (e.t === 'void') this.err(`This function returns nothing (void), so there is no value to use.`, line);
      if (to === e.t) return e.js;
      this.err(`Can't use a ${this.tyName(e.t)} where a ${this.tyName(to)} is needed.`, line);
    }
    switch (to) {
      case 'int': case 'char': return e.t === 'float' ? `Math.trunc(${e.js})` : e.t === 'bool' ? `+(${e.js})` : e.js;
      case 'byte': return `((${e.js})&255)`;
      case 'bool': return `!!(${e.js})`;
      case 'float': return e.t === 'bool' ? `+(${e.js})` : e.js;
      case 'void': return e.js;
    }
    this.err(`Can't use a number where a ${this.tyName(to)} is needed.`, line);
  }
  private tyName(t: Ty) {
    return t === 'int' ? 'whole number (int)' : t === 'float' ? 'decimal number (float)' : t === 'String' ? 'String' : t.endsWith('[]') ? 'array' : t;
  }
  private zero(t: Ty) { return t === 'String' ? '""' : t === 'bool' ? 'false' : '0'; }

  // ---- program ----
  compile(): string {
    this.collectFunctions();
    const out: string[] = [];
    while (this.t.k !== 'eof') out.push(this.topLevel());
    if (!this.funcs.has('setup')) throw new CompileError('Your sketch needs a setup() function. It runs once when the board starts.', 1);
    if (!this.funcs.has('loop')) throw new CompileError('Your sketch needs a loop() function. It runs again and again after setup().', 1);
    return `"use strict";\n${this.hoisted.join('\n')}\n${out.join('\n')}\nreturn { setup: $setup, loop: $loop };`;
  }

  private skipBalanced(open: string, close: string) {
    let depth = 0;
    for (;;) {
      if (this.t.k === 'eof') this.err(`A ${open} is never closed with ${close}`, this.toks[Math.max(0, this.i - 1)].line);
      if (this.t.k === 'p' && this.t.v === open) depth++;
      if (this.t.k === 'p' && this.t.v === close) { depth--; if (depth === 0) { this.i++; return; } }
      this.i++;
    }
  }

  /** First pass: learn every function's name and types so calls can come before definitions. */
  private collectFunctions() {
    const start = this.i;
    while (this.t.k !== 'eof') {
      if (!this.typeAhead()) { this.i++; continue; }
      let ty;
      try { ty = this.parseType(); } catch { this.i++; continue; }
      if (this.t.k === 'id' && this.peek().v === '(' && !CLASSES.includes(ty.t)) {
        const name = this.toks[this.i++].v;
        const params = this.parseParams();
        this.funcs.set(name, { ret: ty.t, params });
        if (this.is('{')) this.skipBalanced('{', '}'); else this.eat(';');
      } else {
        while ((this.t.k as string) !== 'eof' && !this.is(';')) { if (this.is('{')) this.skipBalanced('{', '}'); else this.i++; }
        this.eat(';');
      }
    }
    this.i = start;
  }

  private parseParams(): Fn['params'] {
    this.expect('(', 'to start the parameter list');
    const params: Fn['params'] = [];
    if (this.is('void') && this.peek().v === ')') this.i++;
    while (!this.is(')')) {
      const ty = this.parseType();
      const name = this.t.k === 'id' ? this.ident('a parameter name') : `_p${params.length}`;
      let t = ty.t;
      while (this.eat('[')) { while (!this.is(']') && this.t.k !== 'eof') this.i++; this.expect(']', 'after ['); t += '[]'; }
      if (this.eat('=')) this.assignment();
      params.push({ name, t, sz: ty.sz });
      if (!this.eat(',')) break;
    }
    this.expect(')', 'to close the parameter list');
    return params;
  }

  private topLevel(): string {
    const bad = UNSUPPORTED[this.t.v];
    if (this.t.k === 'id' && bad) this.err(bad);
    if (!this.typeAhead()) {
      if (this.t.k === 'id' && this.peek().v === '(') this.err(`Code like "${this.t.v}(...)" has to go inside a function such as setup() or loop().`);
      this.err(`I expected a variable or function here, but found "${this.t.v}".`);
    }
    const line = this.t.line;
    const ty = this.parseType();
    if (this.t.k === 'id' && this.peek().v === '(' && !CLASSES.includes(ty.t)) {
      const name = this.toks[this.i++].v;
      const fn = this.funcs.get(name)!;
      this.scopes.push(new Map());
      const params = this.parseParams();
      if (this.eat(';')) { this.scopes.pop(); return ''; }
      params.forEach(p => this.defineVar(p.name, p.t, p.sz, line));
      this.curFn = { name, ret: fn.ret };
      const body = this.block(false);
      this.curFn = null;
      this.scopes.pop();
      return `function* $${name}(${params.map(p => `$${p.name}`).join(',')}){if(rt.tick())yield;${body}}`;
    }
    return this.declaration(ty, 'let');
  }

  // ---- declarations ----
  private declaration(ty: { t: Ty; sz: number; isStatic: boolean }, kw: string): string {
    const parts: string[] = [];
    const isStaticLocal = ty.isStatic && this.curFn !== null;
    do {
      const line = this.t.line;
      const name = this.ident('a variable name');
      let t = ty.t;
      const dims: string[] = [];
      while (this.eat('[')) {
        dims.push(this.is(']') ? '' : this.assignment().js);
        this.expect(']', 'after the array size');
        t += '[]';
      }
      let init: string;
      if (CLASSES.includes(ty.t)) {
        const args: string[] = [];
        if (this.eat('(')) { while (!this.is(')')) { args.push(this.assignment().js); if (!this.eat(',')) break; } this.expect(')', 'after the arguments'); }
        init = `rt.make('${ty.t}',[${args.join(',')}])`;
      } else if (dims.length) {
        if (this.eat('=')) {
          if (this.t.k === 'str' && ty.t === 'char') { t = 'String'; init = JSON.stringify(this.toks[this.i++].v); }
          else init = this.initList(ty.t, dims.length);
        } else {
          if (dims.some(d => d === '')) this.err(`The array "${name}" needs a size, like ${name}[5].`, line);
          init = dims.length === 1 ? `rt.arr(${dims[0]},${this.zero(ty.t)})` : `rt.arr2(${dims[0]},${dims[1]},${this.zero(ty.t)})`;
        }
      } else if (this.eat('=')) {
        const el = this.t.line;
        init = this.coerce(t, this.assignment(), el);
      } else if (this.is('(') && ty.t === 'String') {
        this.i++; const e = this.assignment(); this.expect(')', 'after the value');
        init = this.coerce('String', e, line);
      } else init = this.zero(t);

      if (t === 'void') this.err(`A variable can't be void. Pick a type like int.`, line);
      if (isStaticLocal) {
        const js = `$${this.curFn!.name}$${name}$${this.uid++}`;
        this.defineVar(name, t, ty.sz, line, js);
        this.hoisted.push(`let ${js}=${init};`);
      } else {
        const v = this.defineVar(name, t, ty.sz, line);
        parts.push(`${v.js}=${init}`);
      }
    } while (this.eat(','));
    this.expect(';', 'at the end of this line');
    return parts.length ? `${kw} ${parts.join(',')};` : '';
  }

  private initList(elem: Ty, depth: number): string {
    this.expect('{', 'to start the list of values');
    const items: string[] = [];
    while (!this.is('}')) {
      if (depth > 1) items.push(this.initList(elem, depth - 1));
      else { const l = this.t.line; items.push(this.coerce(elem, this.assignment(), l)); }
      if (!this.eat(',')) break;
    }
    this.expect('}', 'to close the list of values');
    return `[${items.join(',')}]`;
  }

  // ---- statements ----
  private block(newScope = true): string {
    this.expect('{', 'to start this block');
    if (newScope) this.scopes.push(new Map());
    const out: string[] = [];
    while (!this.is('}')) {
      if (this.t.k === 'eof') this.err('A { is never closed with }', this.toks[this.i - 1].line);
      out.push(this.statement());
    }
    this.i++;
    if (newScope) this.scopes.pop();
    return `{${out.join('')}}`;
  }

  private scoped(f: () => string): string {
    this.scopes.push(new Map());
    const r = f();
    this.scopes.pop();
    return r;
  }

  private cond(what: string): string {
    this.expect('(', `after ${what}`);
    const e = this.expression();
    this.expect(')', `to close the ${what} condition`);
    if (e.t === 'void') this.err(`The ${what} condition has no value to test.`);
    return e.js;
  }

  private statement(): string {
    const tok = this.t;
    if (tok.k === 'p' && tok.v === '{') return this.block();
    if (tok.k === 'p' && tok.v === ';') { this.i++; return ';'; }
    if (tok.k === 'id') {
      if (UNSUPPORTED[tok.v]) this.err(UNSUPPORTED[tok.v]);
      switch (tok.v) {
        case 'if': {
          this.i++;
          const c = this.cond('if');
          const a = this.scoped(() => this.statement());
          const b = this.eat('else') ? `else ${this.scoped(() => this.statement())}` : '';
          return `if(${c}){${a}}${b}`;
        }
        case 'while': {
          this.i++;
          const c = this.cond('while');
          return `while(${c}){if(rt.tick())yield;${this.scoped(() => this.statement())}}`;
        }
        case 'do': {
          this.i++;
          const body = this.scoped(() => this.statement());
          if (!this.eat('while')) this.err('A do { } block must end with while (condition);');
          const c = this.cond('while');
          this.expect(';', 'after the do-while loop');
          return `do{if(rt.tick())yield;${body}}while(${c});`;
        }
        case 'for': {
          this.i++;
          return this.scoped(() => {
            this.expect('(', 'after for');
            let init = ';';
            if (this.typeAhead()) init = this.declaration(this.parseType(), 'let');
            else if (!this.eat(';')) { init = `${this.expression().js};`; this.expect(';', 'after the first part of for'); }
            const c = this.is(';') ? 'true' : this.expression().js;
            this.expect(';', 'after the for condition');
            const step = this.is(')') ? '' : this.expression().js;
            this.expect(')', 'to close the for loop header');
            return `for(${init}${c};${step}){if(rt.tick())yield;${this.scoped(() => this.statement())}}`;
          });
        }
        case 'switch': {
          this.i++;
          const c = this.cond('switch');
          this.expect('{', 'after switch (...)');
          return this.scoped(() => {
            let out = `switch(+(${c})){`;
            while (!this.is('}')) {
              if (this.t.k === 'eof') this.err('This switch is never closed with }');
              if (this.eat('case')) { out += `case +(${this.ternary().js}):`; this.expect(':', 'after the case value'); }
              else if (this.eat('default')) { this.expect(':', 'after default'); out += 'default:'; }
              else out += this.statement();
            }
            this.i++;
            return out + '}';
          });
        }
        case 'break': this.i++; this.expect(';', 'after break'); return 'break;';
        case 'continue': this.i++; this.expect(';', 'after continue'); return 'continue;';
        case 'return': {
          this.i++;
          if (this.eat(';')) return 'return;';
          const line = this.t.line;
          const e = this.expression();
          this.expect(';', 'after return');
          const ret = this.curFn?.ret ?? 'void';
          if (ret === 'void') this.err(`${this.curFn?.name}() is void, so it can't return a value.`, line);
          return `return ${this.coerce(ret, e, line)};`;
        }
        case 'else': this.err('This else has no matching if before it.');
      }
      if (this.typeAhead() && !(this.peek().v === '(' && !QUALIFIERS.includes(tok.v))) return this.declaration(this.parseType(), 'let');
    }
    const e = this.expression();
    this.expect(';', 'at the end of this line');
    return `${e.js};`;
  }

  // ---- expressions ----
  private expression(): Ex {
    let e = this.assignment();
    while (this.eat(',')) { const r = this.assignment(); e = { js: `(${e.js},${r.js})`, t: r.t }; }
    return e;
  }

  private assignment(): Ex {
    const line = this.t.line;
    const left = this.ternary();
    const op = this.t.k === 'p' ? this.t.v : '';
    if (op === '=' || (op.length >= 2 && op.endsWith('=') && !['==', '!=', '<=', '>='].includes(op))) {
      this.i++;
      if (!left.lv) this.err(`The left side of ${op} must be a variable.`, line);
      const right = this.assignment();
      if (op === '=') return { js: `(${left.js}=${this.coerce(left.t, right, line)})`, t: left.t };
      const combined = this.binary(op.slice(0, -1), left, right, line);
      return { js: `(${left.js}=${this.coerce(left.t, combined, line)})`, t: left.t };
    }
    return left;
  }

  private ternary(): Ex {
    const c = this.binaryLevel(0);
    if (!this.eat('?')) return c;
    const a = this.assignment();
    this.expect(':', 'in the ? : expression');
    const b = this.assignment();
    const t = a.t === 'String' || b.t === 'String' ? 'String' : isNum(a.t) && isNum(b.t) ? numTy(a.t, b.t) : a.t;
    return { js: `((${c.js})?(${a.js}):(${b.js}))`, t };
  }

  private static LEVELS = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];

  private binaryLevel(level: number): Ex {
    if (level >= Parser.LEVELS.length) return this.unary();
    let left = this.binaryLevel(level + 1);
    while (this.t.k === 'p' && Parser.LEVELS[level].includes(this.t.v)) {
      const line = this.t.line;
      const op = this.toks[this.i++].v;
      left = this.binary(op, left, this.binaryLevel(level + 1), line);
    }
    return left;
  }

  private binary(op: string, a: Ex, b: Ex, line: number): Ex {
    const str = a.t === 'String' || b.t === 'String';
    if (a.t === 'void' || b.t === 'void') this.err(`One side of ${op} is a function that returns nothing.`, line);
    if (op === '+' && str) return { js: `(${this.coerce('String', a, line)}+${this.coerce('String', b, line)})`, t: 'String' };
    if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      if (str && a.t !== b.t) {
        if (a.t === 'char' || b.t === 'char') return { js: `(${this.coerce('String', a, line)}${op}${this.coerce('String', b, line)})`, t: 'bool' };
        this.err(`Can't compare text with a number using ${op}.`, line);
      }
      return { js: `(${a.js}${op}${b.js})`, t: 'bool' };
    }
    if (op === '&&' || op === '||') return { js: `!!(${a.js}${op}${b.js})`, t: 'bool' };
    if (!isNum(a.t) || !isNum(b.t)) this.err(`The ${op} operator needs numbers on both sides.`, line);
    const ints = isInt(a.t) && isInt(b.t);
    if (op === '/') return ints ? { js: `rt.idiv(${a.js},${b.js})`, t: 'int' } : { js: `(${a.js}/${b.js})`, t: 'float' };
    if (op === '%') {
      if (!ints) this.err('The % operator only works with whole numbers. Use fmod-style math for decimals.', line);
      return { js: `rt.imod(${a.js},${b.js})`, t: 'int' };
    }
    if (['|', '^', '&', '<<', '>>'].includes(op)) return { js: `(${a.js}${op}${b.js})`, t: 'int' };
    return { js: `(${a.js}${op}${b.js})`, t: numTy(a.t, b.t) };
  }

  private unary(): Ex {
    const tok = this.t;
    if (tok.k === 'p') {
      if (tok.v === '!') { this.i++; return { js: `!(${this.unary().js})`, t: 'bool' }; }
      if (tok.v === '-' || tok.v === '+' || tok.v === '~') {
        this.i++;
        const e = this.unary();
        if (!isNum(e.t)) this.err(`${tok.v} needs a number after it.`, tok.line);
        return { js: `(${tok.v}(${e.js}))`, t: tok.v === '~' ? 'int' : numTy(e.t) };
      }
      if (tok.v === '++' || tok.v === '--') {
        this.i++;
        const e = this.unary();
        if (!e.lv || !isNum(e.t)) this.err(`${tok.v} only works on a number variable.`, tok.line);
        return { js: e.t === 'byte' ? `(${e.js}=(${e.js}${tok.v[0]}1)&255)` : `(${tok.v}${e.js})`, t: e.t };
      }
      if (tok.v === '&' || tok.v === '*') this.err('Pointers (& and *) are not supported in this simulator yet.');
      // C-style cast: (int)x
      if (tok.v === '(' && this.peek().k === 'id' && TYPE_WORDS.has(this.peek().v)) {
        this.i++;
        const ty = this.parseType();
        this.expect(')', 'to close the type cast');
        return this.cast(ty.t, this.unary(), tok.line);
      }
    }
    if (tok.k === 'id' && tok.v === 'sizeof') {
      this.i++;
      this.expect('(', 'after sizeof');
      let r: Ex;
      if (this.typeAhead()) { const ty = this.parseType(); r = { js: String(ty.sz), t: 'int' }; }
      else {
        const e = this.expression();
        r = e.t.endsWith('[]') ? { js: `(${e.js}.length*${e.sz ?? 2})`, t: 'int' } : { js: String(e.sz ?? SIZE[e.t] ?? 2), t: 'int' };
      }
      this.expect(')', 'to close sizeof');
      return r;
    }
    return this.postfix();
  }

  private cast(to: Ty, e: Ex, line: number): Ex {
    if (to === 'String') return { js: this.coerce('String', e, line), t: 'String' };
    if (to === 'char' && e.t === 'String') this.err("Can't turn text into a single char. Use text[0] or .charAt(0).", line);
    return { js: this.coerce(to, e, line), t: to };
  }

  private args(): Ex[] {
    const out: Ex[] = [];
    while (!this.is(')')) {
      out.push(this.assignment());
      if (!this.eat(',')) break;
    }
    this.expect(')', 'to close the function call');
    return out;
  }

  private postfix(): Ex {
    let e = this.primary();
    for (;;) {
      const tok = this.t;
      if (tok.k !== 'p') break;
      if (tok.v === '[') {
        this.i++;
        const idx = this.expression();
        this.expect(']', 'after the array index');
        if (e.t === 'String') e = { js: `rt.at(${e.js},${idx.js})`, t: 'char' };
        else if (e.t.endsWith('[]')) e = { js: `${e.js}[${idx.js}]`, t: e.t.slice(0, -2), lv: true, sz: e.sz };
        else this.err(`Only arrays and Strings can use [ ]. This is a ${this.tyName(e.t)}.`, tok.line);
      } else if (tok.v === '.') {
        this.i++;
        const name = this.t.k === 'id' ? this.toks[this.i++].v : this.err('Expected a function name after the dot.');
        this.expect('(', `after .${name}`);
        e = this.method(e, name, this.args(), tok.line);
      } else if (tok.v === '++' || tok.v === '--') {
        this.i++;
        if (!e.lv || !isNum(e.t)) this.err(`${tok.v} only works on a number variable.`, tok.line);
        e = { js: e.t === 'byte' ? `(${e.js}=(${e.js}${tok.v[0]}1)&255)` : `(${e.js}${tok.v})`, t: e.t };
      } else if (tok.v === '->') this.err('Pointers (->) are not supported in this simulator yet.');
      else break;
    }
    return e;
  }

  private method(obj: Ex, name: string, args: Ex[], line: number): Ex {
    const a = args.map(x => x.js);
    if (obj.t === 'String') {
      const s = obj.js;
      const strArg = (k: number) => (args[k] ? this.coerce('String', args[k], line) : '""');
      const mutate = (js: string): Ex => {
        if (!obj.lv) this.err(`.${name}() changes the String, so it needs a variable.`, line);
        return { js: `(${s}=${js})`, t: 'void' };
      };
      switch (name) {
        case 'length': return { js: `${s}.length`, t: 'int' };
        case 'toInt': return { js: `rt.toInt(${s})`, t: 'int' };
        case 'toFloat': case 'toDouble': return { js: `rt.toFloat(${s})`, t: 'float' };
        case 'charAt': return { js: `rt.at(${s},${a[0]})`, t: 'char' };
        case 'substring': return { js: `${s}.substring(${a.join(',')})`, t: 'String' };
        case 'indexOf': return { js: `${s}.indexOf(${strArg(0)}${a[1] ? `,${a[1]}` : ''})`, t: 'int' };
        case 'lastIndexOf': return { js: `${s}.lastIndexOf(${strArg(0)})`, t: 'int' };
        case 'equals': return { js: `(${s}==${strArg(0)})`, t: 'bool' };
        case 'equalsIgnoreCase': return { js: `(${s}.toLowerCase()==${strArg(0)}.toLowerCase())`, t: 'bool' };
        case 'startsWith': return { js: `${s}.startsWith(${strArg(0)})`, t: 'bool' };
        case 'endsWith': return { js: `${s}.endsWith(${strArg(0)})`, t: 'bool' };
        case 'isEmpty': return { js: `(${s}.length==0)`, t: 'bool' };
        case 'trim': return mutate(`${s}.trim()`);
        case 'toUpperCase': return mutate(`${s}.toUpperCase()`);
        case 'toLowerCase': return mutate(`${s}.toLowerCase()`);
        case 'concat': return mutate(`${s}+${strArg(0)}`);
        case 'replace': return mutate(`${s}.split(${strArg(0)}).join(${strArg(1)})`);
        case 'remove': return mutate(`rt.remove(${s},${a.join(',')})`);
      }
      this.err(`String has no function called ${name}().`, line);
    }
    const table = METHODS[obj.t];
    if (!table) this.err(`A ${this.tyName(obj.t)} has no functions you can call with a dot.`, line);
    if (!(name in table)) {
      const close = Object.keys(table).find(k => k.toLowerCase() === name.toLowerCase());
      this.err(`${obj.t} has no function called ${name}().${close ? ` Did you mean ${close}()?` : ''}`, line);
    }
    if (name === 'print' || name === 'println') {
      if (!args.length) return { js: `${obj.js}.${name}("","String")`, t: 'void' };
      if (args[0].t === 'void' || args[0].t.endsWith('[]') || METHODS[args[0].t]) this.err(`${name}() can't show this value. Print a number, a char or text.`, line);
      return { js: `${obj.js}.${name}(${a[0]},'${args[0].t}'${a[1] ? `,${a[1]}` : ''})`, t: 'void' };
    }
    return { js: `${obj.js}.${name}(${a.join(',')})`, t: table[name] };
  }

  private primary(): Ex {
    const tok = this.t;
    switch (tok.k) {
      case 'num': this.i++; return { js: tok.v, t: tok.f ? 'float' : 'int' };
      case 'chr': this.i++; return { js: tok.v, t: 'char' };
      case 'str': this.i++; return { js: JSON.stringify(tok.v), t: 'String' };
      case 'p':
        if (tok.v === '(') {
          this.i++;
          const e = this.expression();
          this.expect(')', 'to close the bracket');
          return { js: `(${e.js})`, t: e.t };
        }
        break;
      case 'id': {
        if (UNSUPPORTED[tok.v]) this.err(UNSUPPORTED[tok.v]);
        // Function-style cast: int(x), float(x), String(x, 2)
        if (TYPE_WORDS.has(tok.v) && !CLASSES.includes(tok.v)) {
          const ty = this.parseType();
          this.expect('(', `after ${tok.v}`);
          const args = this.args();
          if (!args.length) return { js: this.zero(ty.t), t: ty.t };
          if (ty.t === 'String' && args[1] && isNum(args[0].t)) return { js: `rt.str(${args[0].js},'${args[0].t}',${args[1].js})`, t: 'String' };
          return this.cast(ty.t, args[0], tok.line);
        }
        this.i++;
        if (this.is('(')) {
          this.i++;
          const args = this.args();
          if (tok.v === 'F' && args.length === 1) return args[0];
          const b = BUILTINS[tok.v];
          if (b) {
            if (args.length < (b.min ?? 0)) this.err(`${tok.v}() needs ${b.min} value${b.min === 1 ? '' : 's'} inside the brackets, but got ${args.length}.`, tok.line);
            args.forEach(x => { if (!isNum(x.t)) this.err(`${tok.v}() needs numbers, but got a ${this.tyName(x.t)}.`, tok.line); });
            return { js: b.js(args.map(x => x.js)), t: typeof b.ret === 'function' ? b.ret(args) : b.ret };
          }
          const fn = this.funcs.get(tok.v);
          if (!fn) {
            const all = [...Object.keys(BUILTINS), ...this.funcs.keys()];
            const close = all.find(k => k.toLowerCase() === tok.v.toLowerCase());
            this.err(`There is no function called ${tok.v}().${close ? ` Did you mean ${close}()? Capital letters matter.` : ''}`, tok.line);
          }
          if (args.length !== fn.params.length) this.err(`${tok.v}() takes ${fn.params.length} value${fn.params.length === 1 ? '' : 's'}, but got ${args.length}.`, tok.line);
          const js = args.map((x, k) => this.coerce(fn.params[k].t, x, tok.line));
          return { js: `(yield* $${tok.v}(${js.join(',')}))`, t: fn.ret };
        }
        const v = this.lookup(tok.v);
        if (v) return { js: v.js, t: v.t, lv: !METHODS[v.t], sz: v.sz };
        const c = CONSTANTS[tok.v];
        if (c) return { js: c[0], t: c[1] };
        if (this.funcs.has(tok.v) || BUILTINS[tok.v]) this.err(`${tok.v} is a function. Add brackets to call it: ${tok.v}()`, tok.line);
        const names = [...this.scopes.flatMap(s => [...s.keys()]), ...Object.keys(CONSTANTS)];
        const close = names.find(k => k.toLowerCase() === tok.v.toLowerCase());
        this.err(`"${tok.v}" has not been declared.${close ? ` Did you mean ${close}? Capital letters matter.` : ' Declare it first, for example: int ' + tok.v + ' = 0;'}`, tok.line);
      }
    }
    if (tok.k === 'eof') this.err('The sketch ends in the middle of a statement.', this.toks[Math.max(0, this.i - 1)].line);
    this.err(`I didn't expect "${tok.v}" here.`);
  }
}

export interface Sketch {
  setup: () => Generator<void, void, void>;
  loop: () => Generator<void, void, void>;
}

/** Compiles a sketch. Throws CompileError with a line number when the code is wrong. */
export function compile(src: string): (rt: unknown) => Sketch {
  const js = new Parser(src).compile();
  try {
    return new Function('rt', js) as (rt: unknown) => Sketch;
  } catch (e) {
    throw new CompileError(`This sketch could not be built (${(e as Error).message}).`, 1);
  }
}
