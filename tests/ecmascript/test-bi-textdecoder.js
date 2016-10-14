/*
 *  TextDecoder
 */

/*@include util-buffer.js@*/

/*===
basic decode
utf-8
false
false
2
55357 56375
true
5
65533 65 66 67 68
true
0
true
===*/

function decodeTest() {
    var decoder;
    var ref, input, output;

    decoder = new TextDecoder();  // defaults to UTF-8
    print(decoder.encoding);
    print(decoder.fatal);
    print(decoder.ignoreBOM);

    // non-BMP codepoint should become a surrogate pair
    input = new Uint8Array([ 0xf0, 0x9f, 0x90, 0xb7 ]);
    ref = '\ud83d\udc37';
    output = decoder.decode(input);
    print(output.length);  // should be 2
    print(output.charCodeAt(0), output.charCodeAt(1));
    print(output === ref);

    // incomplete codepoint should not mask characters
    input = new Uint8Array([ 0xf0, 0x41, 0x42, 0x43, 0x44 ]);
    ref = '\ufffdABCD';
    output = decoder.decode(input);
    print(output.length);
    print(output.charCodeAt(0), output.charCodeAt(1), output.charCodeAt(2), output.charCodeAt(3), output.charCodeAt(4));
    print(output === ref);

    // no argument is the same as an empty buffer
    ref = '';
    output = decoder.decode();
    print(output.length);
    print(output === ref);

}

try {
    print('basic decode');
    decodeTest();
} catch (e) {
    print(e.stack || e);
}

/*===
fatal mode
true
false
foo
true
TypeError
===*/

function fatalTest() {
    var fatal, nonFatal;
    var ref, input, output;

    fatal = new TextDecoder('utf-8', { fatal: true });
    print(fatal.fatal);
    nonFatal = new TextDecoder('utf-8', { fatal: false });
    print(nonFatal.fatal);

    // well-formed input, should not throw
    input = new Uint8Array([ 0x66, 0x6f, 0x6f ]);
    ref = 'foo';
    output = fatal.decode(input);
    print(output);

    // buffer contains invalid UTF-8 code unit 0xFF
    input = new Uint8Array([ 0x62, 0x61, 0x72, 0xff ]);
    ref = 'bar\ufffd';
    print(nonFatal.decode(input) === ref);
    try {
        print(fatal.decode(input));
    } catch (e) {
        print(e.name);
    }
}

try {
    print('fatal mode');
    fatalTest();
} catch (e) {
    print(e.stack || e);
}

/*===
ignore BOM
false
true
true
true
===*/

function ignoreBOMTest() {
    var stripBOM, keepBOM;
    var ref, input, output;

    var stripBOM = new TextDecoder('utf-8', { ignoreBOM: false });
    print(stripBOM.ignoreBOM);
    var keepBOM = new TextDecoder('utf-8', { ignoreBOM: true });
    print(keepBOM.ignoreBOM);

    input = new Uint8Array([ 0xef, 0xbb, 0xbf, 0x42, 0x4f, 0x4d ]);
    ref = '\ufeffBOM';
    output = keepBOM.decode(input);
    print(output === ref);
    ref = 'BOM';
    output = stripBOM.decode(input);
    print(output === ref);
}

try {
    print('ignore BOM');
    ignoreBOMTest();
} catch (e) {
    print(e.stack || e);
}

/*===
streaming
true
true
===*/

function streamTest()
{
    var decoder;
    var ref, input, output;

    // include a multi-byte character to test streaming correctness
    decoder = new TextDecoder();
    ref = 'pig \ud83d\udc37';
    input = new Uint8Array([ 0x70, 0x69, 0x67, 0x20, 0xf0, 0x9f, 0x90, 0xb7 ]);
    output = '';
    for (var i = 0; i < input.length; ++i) {
        var byte = input.subarray(i, i + 1);
        output += decoder.decode(byte, { stream: true });
    }
    output += decoder.decode();
    print(output === ref);

    // incomplete codepoint at end of string is caught in final decode().
    // note that it's safe to reuse the decoder instance for another go as long
    // as the last call to decode() was with {stream:false} (the default).
    ref = 'pig \ud83d\udc37\ufffd';
    input = new Uint8Array([ 0x70, 0x69, 0x67, 0x20, 0xf0, 0x9f, 0x90, 0xb7, 0xf0 ]);
    output = '';
    for (var i = 0; i < input.length; ++i) {
        var byte = input.subarray(i, i + 1);
        output += decoder.decode(byte, { stream: true });
    }
    output += decoder.decode();
    print(output === ref);
}

try {
    print('streaming');
    streamTest();
} catch (e) {
    print(e.stack || e);
}

/*===
argument coercion and validation
0 [object Undefined] 0 NaN ""
1 [object Null] TypeError
2 [object Boolean] TypeError
3 [object Boolean] TypeError
4 [object Number] TypeError
5 [object String] TypeError
6 [object String] TypeError
7 [object Number] TypeError
8 [object Function] TypeError
9 [object ArrayBuffer] 7 102 "foo\ucafebar"
10 [object ArrayBuffer] 2 51966 "\ucafe\ufffd"
11 [object Uint16Array] 4 66 "BADC"
12 [object Float64Array] 8 111 "o/ Hello"
13 [object Uint8Array] 7 102 "foo\ucafebar"
14 [object Array] TypeError
15 [object Object] TypeError
0 [object Undefined] 1 65533
1 [object Null] 1 65533
2 [object Boolean] TypeError
3 [object Boolean] TypeError
4 [object Number] TypeError
5 [object String] TypeError
6 [object String] 0 NaN
7 [object Number] 1 65533
8 [object ArrayBuffer] 1 65533
9 [object Function] 1 65533
10 [object ArrayBuffer] 1 65533
11 [object Float32Array] 1 65533
12 [object Uint8Array] 1 65533
13 [object Array] 1 65533
14 [object Array] 0 NaN
15 [object Object] 1 65533
16 [object Object] 0 NaN
17 [object Object] 1 65533
===*/

// Argument coercions and validation.

function argumentTest() {
    // First argument: any buffer object is accepted.  The actual bytes
    // underlying the input (ArrayBuffer or typed array) are used for the
    // decoding process - not the logical elements of a typed array.  Bytes
    // will be in platform dependent order when element size is > 1 byte.
    // Duktape also accepts plain buffers (mimicing ArrayBuffer) and Node.js
    // buffers (which are Uint8Arrays).  Undefined is accepted and is treated
    // like e.g. new Uint8Array(0); null is not.

    var pb = createPlainBuffer('foo\ucafebar');
    var ab = new ArrayBuffer(4);
    ab[0] = 0xec; ab[1] = 0xab; ab[2] = 0xbe; ab[3] = 0xff;
    [
        undefined,
        null,
        true,
        false,
        123,
        'dummy',
        new String('dummy'),
        new Number(123),
        Math.cos,  // function; lightfunc if built-in lightfuncs
        pb,
        ab,
        new Uint16Array([ 0x4142, 0x4344 ]),  // result endian dependent
        new Float64Array([ 5.386703426890001e+228 ]),  // ditto
        new Buffer('foo\ucafebar'),
        [ 1, 2, 3 ],
        { foo: true }
    ].forEach(function (v, i) {
        try {
            var res = new TextDecoder().decode(v);
            print(i, Object.prototype.toString.call(v), res.length, res.charCodeAt(0), Duktape.enc('jx', res));
        } catch (e) {
            print(i, Object.prototype.toString.call(v), e.name);
        }
    });

    // Second argument:
    // Accept missing/undefined/null as "no options", otherwise require an
    // object (verified against Firefox and Chrome).  Boxed Strings, Numbers,
    // etc *are* accepted.  Because lightfuncs mimic functions and plain
    // buffers mimic ArrayBuffers, they're accepted too (although that makes
    // little practical difference).

    String.prototype.stream = true;  // gets inherited for String object argument
    var arr1 = [];
    var arr2 = []; arr2.stream = true;
    [
        undefined,
        null,
        true,
        false,
        123,
        'dummy',
        new String('dummy'),
        new Number(123),
        createPlainBuffer(10),
        Math.cos,  // function; lightfunc if built-in lightfuncs
        new ArrayBuffer(10),
        new Float32Array(10),
        new Buffer(10),
        arr1,
        arr2,
        { foo: true },
        { foo: true, stream: true },
        { foo: true, stream: false }
    ].forEach(function (v, i) {
        // U+CAFE -> UTF-8: EC AB BE
        try {
            // Result is codepoint 65533 (U+FFFD) if no streaming;
            // zero length and NaN in streaming mode.
            var res = new TextDecoder().decode(new Uint8Array([ 0xec, 0xab ]), v);
            print(i, Object.prototype.toString.call(v), res.length, res.charCodeAt(0));
        } catch (e) {
            print(i, Object.prototype.toString.call(v), e.name);
        }
    });

    delete String.prototype.stream;
}

try {
    print('argument coercion and validation');
    argumentTest();
} catch (e) {
    print(e.stack || e);
}
