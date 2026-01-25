7.1 Further Optimizations (Future Work)
Worker Threads: Move heavy parsing to worker threads

Streaming: Use streams for very large brew outputs

Compression: Cache compressed values for large outputs

const compressed = zlib.deflateSync(output);