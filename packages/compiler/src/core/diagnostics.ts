import { CharCode } from "./charcode.js";
import { formatLog } from "./logger/index.js";
import type { Program } from "./program.js";
import {
  Diagnostic,
  DiagnosticResult,
  DiagnosticTarget,
  LogSink,
  Node,
  NodeFlags,
  NoTarget,
  SourceFile,
  SourceLocation,
  SymbolFlags,
  SyntaxKind,
  Type,
} from "./types.js";

/**
 * Represents a failure while interpreting a projection.
 */
export class ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectionError";
  }
}

export type WriteLine = (text?: string) => void;
export type DiagnosticHandler = (diagnostic: Diagnostic) => void;

export function logDiagnostics(diagnostics: readonly Diagnostic[], logger: LogSink) {
  for (const diagnostic of diagnostics) {
    logger.log({
      level: diagnostic.severity,
      message: diagnostic.message,
      code: diagnostic.code,
      sourceLocation: getSourceLocation(diagnostic.target, { locateId: true }),
    });
  }
}

export function formatDiagnostic(diagnostic: Diagnostic) {
  return formatLog(
    {
      code: diagnostic.code,
      level: diagnostic.severity,
      message: diagnostic.message,
      sourceLocation: getSourceLocation(diagnostic.target, { locateId: true }),
    },
    { pretty: false }
  );
}

export function createSourceFile(text: string, path: string): SourceFile {
  let lineStarts: number[] | undefined = undefined;

  return {
    text,
    path,
    getLineStarts,
    getLineAndCharacterOfPosition,
  };

  function getLineStarts() {
    return (lineStarts = lineStarts ?? scanLineStarts(text));
  }

  function getLineAndCharacterOfPosition(position: number) {
    const starts = getLineStarts();

    let line = binarySearch(starts, position);

    // When binarySearch returns < 0 indicating that the value was not found, it
    // returns the bitwise complement of the index where the value would need to
    // be inserted to keep the array sorted. So flipping the bits back to this
    // positive index tells us what the line number would be if we were to
    // create a new line starting at the given position, and subtracting 1 from
    // that therefore gives us the line number we're after.
    if (line < 0) {
      line = ~line - 1;
    }

    return {
      line,
      character: position - starts[line],
    };
  }
}

export interface SourceLocationOptions {
  /**
   * If trying to resolve the location of a type with an ID, show the location of the ID node instead of the entire type.
   * This makes sure that the location range is not too large and hard to read.
   */
  locateId?: boolean;
}
export function getSourceLocation(
  target: DiagnosticTarget,
  options?: SourceLocationOptions
): SourceLocation;
export function getSourceLocation(
  target: typeof NoTarget | undefined,
  options?: SourceLocationOptions
): undefined;
export function getSourceLocation(
  target: DiagnosticTarget | typeof NoTarget | undefined,
  options?: SourceLocationOptions
): SourceLocation | undefined;
export function getSourceLocation(
  target: DiagnosticTarget | typeof NoTarget | undefined,
  options: SourceLocationOptions = {}
): SourceLocation | undefined {
  if (target === NoTarget || target === undefined) {
    return undefined;
  }

  if ("file" in target) {
    return target;
  }

  if (!("kind" in target)) {
    // symbol
    if (target.flags & SymbolFlags.Using) {
      target = target.symbolSource!;
    }

    if (!target.declarations[0]) {
      return createSyntheticSourceLocation();
    }

    return getSourceLocationOfNode(target.declarations[0], options);
  } else if (typeof target.kind === "number") {
    // node
    return getSourceLocationOfNode(target as Node, options);
  } else {
    // type
    const targetNode = (target as Type).node;

    if (targetNode) {
      return getSourceLocationOfNode(targetNode, options);
    }

    return createSyntheticSourceLocation();
  }
}

function createSyntheticSourceLocation(loc = "<unknown location>") {
  return {
    file: createSourceFile("", loc),
    pos: 0,
    end: 0,
    isSynthetic: true,
  };
}

function getSourceLocationOfNode(node: Node, options: SourceLocationOptions): SourceLocation {
  let root = node;

  while (root.parent !== undefined) {
    root = root.parent;
  }

  if (root.kind !== SyntaxKind.TypeSpecScript && root.kind !== SyntaxKind.JsSourceFile) {
    return createSyntheticSourceLocation(
      node.flags & NodeFlags.Synthetic
        ? undefined
        : "<unknown location - cannot obtain source location of unbound node - file bug at https://github.com/microsoft/typespec>"
    );
  }

  if (options.locateId && "id" in node && node.id !== undefined) {
    node = node.id;
  }

  return {
    file: root.file,
    pos: node.pos,
    end: node.end,
  };
}

/**
 * Verbose output is enabled by default for runs in mocha explorer in VS Code,
 * where the output is nicely associated with the individual test, and disabled
 * by default for command line runs where we don't want to spam the console.
 *
 * If the steps taken to produce the message are expensive, pass a callback
 * instead of producing the message then passing it here only to be dropped
 * when verbose output is disabled.
 */
export function logVerboseTestOutput(
  messageOrCallback: string | ((log: (message: string) => void) => void)
) {
  if (process.env.TYPESPEC_VERBOSE_TEST_OUTPUT) {
    if (typeof messageOrCallback === "string") {
      // eslint-disable-next-line no-console
      console.log(messageOrCallback);
    } else {
      // eslint-disable-next-line no-console
      messageOrCallback(console.log);
    }
  }
}

/**
 * Use this to report bugs in the compiler, and not errors in the source code
 * being compiled.
 *
 * @param condition Throw if this is not true.
 *
 * @param message Error message.
 *
 * @param target Optional location in source code that might give a clue about
 *               what got the compiler off track.
 */
export function compilerAssert(
  condition: any,
  message: string,
  target?: DiagnosticTarget
): asserts condition {
  if (condition) {
    return;
  }

  if (target) {
    let location: SourceLocation | undefined;
    try {
      location = getSourceLocation(target);
    } catch (err: any) {}

    if (location) {
      const pos = location.file.getLineAndCharacterOfPosition(location.pos);
      const file = location.file.path;
      const line = pos.line + 1;
      const col = pos.character + 1;
      message += `\nOccurred while compiling code in ${file} near line ${line}, column ${col}`;
    }
  }

  throw new Error(message);
}

function scanLineStarts(text: string): number[] {
  const starts = [];
  let start = 0;
  let pos = 0;

  while (pos < text.length) {
    const ch = text.charCodeAt(pos);
    pos++;
    switch (ch) {
      case CharCode.CarriageReturn:
        if (text.charCodeAt(pos) === CharCode.LineFeed) {
          pos++;
        }
      // fallthrough
      case CharCode.LineFeed:
        starts.push(start);
        start = pos;
        break;
    }
  }

  starts.push(start);
  return starts;
}

/**
 * Search sorted array of numbers for the given value. If found, return index
 * in array where value was found. If not found, return a negative number that
 * is the bitwise complement of the index where value would need to be inserted
 * to keep the array sorted.
 */
function binarySearch(array: readonly number[], value: number) {
  let low = 0;
  let high = array.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >> 1);
    const v = array[middle];
    if (v < value) {
      low = middle + 1;
    } else if (v > value) {
      high = middle - 1;
    } else {
      return middle;
    }
  }

  return ~low;
}

/**
 * Assert that the input type has one of the kinds provided
 */
export function assertType<TKind extends Type["kind"][]>(
  typeDescription: string,
  t: Type,
  ...kinds: TKind
): asserts t is Type & { kind: TKind[number] } {
  if (kinds.indexOf(t.kind) === -1) {
    throw new ProjectionError(`Expected ${typeDescription} to be type ${kinds.join(", ")}`);
  }
}

/**
 * Report a deprecated diagnostic.
 * @param program TypeSpec Program.
 * @param message Message describing the deprecation.
 * @param target Target of the deprecation.
 */
export function reportDeprecated(
  program: Program,
  message: string,
  target: DiagnosticTarget | typeof NoTarget
): void {
  program.reportDiagnostic({
    severity: "warning",
    code: "deprecated",
    message: `Deprecated: ${message}`,
    target,
  });
}

/**
 * Helper object to collect diagnostics from function following the diagnostics accessor pattern(foo() => [T, Diagnostic[]])
 */
export interface DiagnosticCollector {
  readonly diagnostics: readonly Diagnostic[];

  /**
   * Add a diagnostic to the collection
   * @param diagnostic Diagnostic to add.
   */
  add(diagnostic: Diagnostic): void;

  /**
   * Unwrap the Diagnostic result, add all the diagnostics and return the data.
   * @param result Accessor diagnostic result
   */
  pipe<T>(result: DiagnosticResult<T>): T;

  /**
   * Wrap the given value in a tuple including the diagnostics following the TypeSpec accessor pattern.
   * @param value Accessor value to return
   * @example return diagnostics.wrap(routes);
   */
  wrap<T>(value: T): DiagnosticResult<T>;
}

/**
 * Create a new instance of the @see DiagnosticCollector.
 */
export function createDiagnosticCollector(): DiagnosticCollector {
  const diagnostics: Diagnostic[] = [];

  return {
    diagnostics,
    add,
    pipe,
    wrap,
  };

  function add(diagnostic: Diagnostic) {
    diagnostics.push(diagnostic);
  }

  function pipe<T>(result: DiagnosticResult<T>): T {
    const [value, diags] = result;
    for (const diag of diags) {
      diagnostics.push(diag);
    }
    return value;
  }

  function wrap<T>(value: T): DiagnosticResult<T> {
    return [value, diagnostics];
  }
}

/**
 * Ignore the diagnostics emitted by the diagnostic accessor pattern and just return the actual result.
 * @param result: Accessor pattern tuple result including the actual result and the list of diagnostics.
 * @returns Actual result.
 */
export function ignoreDiagnostics<T>(result: DiagnosticResult<T>): T {
  return result[0];
}
