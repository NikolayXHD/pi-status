const TITLE_SEQUENCE = /^\u001b\](0|2);[\s\S]*?(?:\u0007|\u001b\\)$/;

export interface TitleStream {
  write(chunk: string | Uint8Array, ...args: any[]): boolean;
}

export interface TitleWriter {
  render(): void;
  dispose(): void;
}

const WRITER_KEY = Symbol.for("pi-status.title-writer");

export function installTitleWriter(
  stream: TitleStream,
  title: () => string,
): TitleWriter {
  const holder = stream as TitleStream & {
    [key: symbol]: TitleWriter | undefined;
  };
  holder[WRITER_KEY]?.dispose();

  const originalWrite = stream.write.bind(stream);
  const writeTitle = () => {
    originalWrite(`\u001b]0;${title()}\u0007`);
  };
  const wrapped = function (
    this: unknown,
    chunk: string | Uint8Array,
    ...args: any[]
  ): boolean {
    if (typeof chunk === "string" && TITLE_SEQUENCE.test(chunk)) {
      writeTitle();
      return true;
    }
    return originalWrite(chunk, ...args);
  };

  let disposed = false;
  const writer: TitleWriter = {
    render: writeTitle,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (stream.write === (wrapped as unknown as TitleStream["write"])) {
        stream.write = originalWrite as TitleStream["write"];
      }
      if (holder[WRITER_KEY] === writer) delete holder[WRITER_KEY];
    },
  };

  stream.write = wrapped as TitleStream["write"];
  holder[WRITER_KEY] = writer;
  return writer;
}
