/*!
 * copyright (c) 2014-2015
 * build time: Sun Dec 20 2015 01:36:58 GMT+0800 (CST)
 */
(function e(t, n, r) {
    function s(o, u) {
        if (!n[o]) {
            if (!t[o]) {
                var a = typeof require == "function" && require;
                if (!u && a) return a(o, !0);
                if (i) return i(o, !0);
                var f = new Error("Cannot find module '" + o + "'");
                throw f.code = "MODULE_NOT_FOUND", f
            }
            var l = n[o] = {exports: {}};
            t[o][0].call(l.exports, function (e) {
                var n = t[o][1][e];
                return s(n ? n : e)
            }, l, l.exports, e, t, n, r)
        }
        return n[o].exports
    }

    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++) s(r[o]);
    return s
})({
    1: [function (require, module, exports) {
        (function (global) {
            /*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
            /* eslint-disable no-proto */

            var base64 = require('base64-js')
            var ieee754 = require('ieee754')
            var isArray = require('is-array')

            exports.Buffer = Buffer
            exports.SlowBuffer = SlowBuffer
            exports.INSPECT_MAX_BYTES = 50
            Buffer.poolSize = 8192 // not used by this implementation

            var rootParent = {}

            /**
             * If `Buffer.TYPED_ARRAY_SUPPORT`:
             *   === true    Use Uint8Array implementation (fastest)
             *   === false   Use Object implementation (most compatible, even IE6)
             *
             * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
             * Opera 11.6+, iOS 4.2+.
             *
             * Due to various browser bugs, sometimes the Object implementation will be used even
             * when the browser supports typed arrays.
             *
             * Note:
             *
             *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
             *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
             *
             *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
             *     on objects.
             *
             *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
             *
             *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
             *     incorrect length in some situations.

             * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
             * get the Object implementation, which is slower but behaves correctly.
             */
            Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
                ? global.TYPED_ARRAY_SUPPORT
                : typedArraySupport()

            function typedArraySupport() {
                function Bar() {
                }

                try {
                    var arr = new Uint8Array(1)
                    arr.foo = function () {
                        return 42
                    }
                    arr.constructor = Bar
                    return arr.foo() === 42 && // typed array instances can be augmented
                        arr.constructor === Bar && // constructor can be set
                        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
                        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
                } catch (e) {
                    return false
                }
            }

            function kMaxLength() {
                return Buffer.TYPED_ARRAY_SUPPORT
                    ? 0x7fffffff
                    : 0x3fffffff
            }

            /**
             * Class: Buffer
             * =============
             *
             * The Buffer constructor returns instances of `Uint8Array` that are augmented
             * with function properties for all the node `Buffer` API functions. We use
             * `Uint8Array` so that square bracket notation works as expected -- it returns
             * a single octet.
             *
             * By augmenting the instances, we can avoid modifying the `Uint8Array`
             * prototype.
             */
            function Buffer(arg) {
                if (!(this instanceof Buffer)) {
                    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
                    if (arguments.length > 1) return new Buffer(arg, arguments[1])
                    return new Buffer(arg)
                }

                this.length = 0
                this.parent = undefined

                // Common case.
                if (typeof arg === 'number') {
                    return fromNumber(this, arg)
                }

                // Slightly less common case.
                if (typeof arg === 'string') {
                    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
                }

                // Unusual.
                return fromObject(this, arg)
            }

            function fromNumber(that, length) {
                that = allocate(that, length < 0 ? 0 : checked(length) | 0)
                if (!Buffer.TYPED_ARRAY_SUPPORT) {
                    for (var i = 0; i < length; i++) {
                        that[i] = 0
                    }
                }
                return that
            }

            function fromString(that, string, encoding) {
                if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

                // Assumption: byteLength() return value is always < kMaxLength.
                var length = byteLength(string, encoding) | 0
                that = allocate(that, length)

                that.write(string, encoding)
                return that
            }

            function fromObject(that, object) {
                if (Buffer.isBuffer(object)) return fromBuffer(that, object)

                if (isArray(object)) return fromArray(that, object)

                if (object == null) {
                    throw new TypeError('must start with number, buffer, array or string')
                }

                if (typeof ArrayBuffer !== 'undefined') {
                    if (object.buffer instanceof ArrayBuffer) {
                        return fromTypedArray(that, object)
                    }
                    if (object instanceof ArrayBuffer) {
                        return fromArrayBuffer(that, object)
                    }
                }

                if (object.length) return fromArrayLike(that, object)

                return fromJsonObject(that, object)
            }

            function fromBuffer(that, buffer) {
                var length = checked(buffer.length) | 0
                that = allocate(that, length)
                buffer.copy(that, 0, 0, length)
                return that
            }

            function fromArray(that, array) {
                var length = checked(array.length) | 0
                that = allocate(that, length)
                for (var i = 0; i < length; i += 1) {
                    that[i] = array[i] & 255
                }
                return that
            }

// Duplicate of fromArray() to keep fromArray() monomorphic.
            function fromTypedArray(that, array) {
                var length = checked(array.length) | 0
                that = allocate(that, length)
                // Truncating the elements is probably not what people expect from typed
                // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
                // of the old Buffer constructor.
                for (var i = 0; i < length; i += 1) {
                    that[i] = array[i] & 255
                }
                return that
            }

            function fromArrayBuffer(that, array) {
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    // Return an augmented `Uint8Array` instance, for best performance
                    array.byteLength
                    that = Buffer._augment(new Uint8Array(array))
                } else {
                    // Fallback: Return an object instance of the Buffer class
                    that = fromTypedArray(that, new Uint8Array(array))
                }
                return that
            }

            function fromArrayLike(that, array) {
                var length = checked(array.length) | 0
                that = allocate(that, length)
                for (var i = 0; i < length; i += 1) {
                    that[i] = array[i] & 255
                }
                return that
            }

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
            function fromJsonObject(that, object) {
                var array
                var length = 0

                if (object.type === 'Buffer' && isArray(object.data)) {
                    array = object.data
                    length = checked(array.length) | 0
                }
                that = allocate(that, length)

                for (var i = 0; i < length; i += 1) {
                    that[i] = array[i] & 255
                }
                return that
            }

            if (Buffer.TYPED_ARRAY_SUPPORT) {
                Buffer.prototype.__proto__ = Uint8Array.prototype
                Buffer.__proto__ = Uint8Array
            }

            function allocate(that, length) {
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    // Return an augmented `Uint8Array` instance, for best performance
                    that = Buffer._augment(new Uint8Array(length))
                    that.__proto__ = Buffer.prototype
                } else {
                    // Fallback: Return an object instance of the Buffer class
                    that.length = length
                    that._isBuffer = true
                }

                var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
                if (fromPool) that.parent = rootParent

                return that
            }

            function checked(length) {
                // Note: cannot use `length < kMaxLength` here because that fails when
                // length is NaN (which is otherwise coerced to zero.)
                if (length >= kMaxLength()) {
                    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                        'size: 0x' + kMaxLength().toString(16) + ' bytes')
                }
                return length | 0
            }

            function SlowBuffer(subject, encoding) {
                if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

                var buf = new Buffer(subject, encoding)
                delete buf.parent
                return buf
            }

            Buffer.isBuffer = function isBuffer(b) {
                return !!(b != null && b._isBuffer)
            }

            Buffer.compare = function compare(a, b) {
                if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                    throw new TypeError('Arguments must be Buffers')
                }

                if (a === b) return 0

                var x = a.length
                var y = b.length

                var i = 0
                var len = Math.min(x, y)
                while (i < len) {
                    if (a[i] !== b[i]) break

                    ++i
                }

                if (i !== len) {
                    x = a[i]
                    y = b[i]
                }

                if (x < y) return -1
                if (y < x) return 1
                return 0
            }

            Buffer.isEncoding = function isEncoding(encoding) {
                switch (String(encoding).toLowerCase()) {
                    case 'hex':
                    case 'utf8':
                    case 'utf-8':
                    case 'ascii':
                    case 'binary':
                    case 'base64':
                    case 'raw':
                    case 'ucs2':
                    case 'ucs-2':
                    case 'utf16le':
                    case 'utf-16le':
                        return true
                    default:
                        return false
                }
            }

            Buffer.concat = function concat(list, length) {
                if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

                if (list.length === 0) {
                    return new Buffer(0)
                }

                var i
                if (length === undefined) {
                    length = 0
                    for (i = 0; i < list.length; i++) {
                        length += list[i].length
                    }
                }

                var buf = new Buffer(length)
                var pos = 0
                for (i = 0; i < list.length; i++) {
                    var item = list[i]
                    item.copy(buf, pos)
                    pos += item.length
                }
                return buf
            }

            function byteLength(string, encoding) {
                if (typeof string !== 'string') string = '' + string

                var len = string.length
                if (len === 0) return 0

                // Use a for loop to avoid recursion
                var loweredCase = false
                for (; ;) {
                    switch (encoding) {
                        case 'ascii':
                        case 'binary':
                        // Deprecated
                        case 'raw':
                        case 'raws':
                            return len
                        case 'utf8':
                        case 'utf-8':
                            return utf8ToBytes(string).length
                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return len * 2
                        case 'hex':
                            return len >>> 1
                        case 'base64':
                            return base64ToBytes(string).length
                        default:
                            if (loweredCase) return utf8ToBytes(string).length // assume utf8
                            encoding = ('' + encoding).toLowerCase()
                            loweredCase = true
                    }
                }
            }

            Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
            Buffer.prototype.length = undefined
            Buffer.prototype.parent = undefined

            function slowToString(encoding, start, end) {
                var loweredCase = false

                start = start | 0
                end = end === undefined || end === Infinity ? this.length : end | 0

                if (!encoding) encoding = 'utf8'
                if (start < 0) start = 0
                if (end > this.length) end = this.length
                if (end <= start) return ''

                while (true) {
                    switch (encoding) {
                        case 'hex':
                            return hexSlice(this, start, end)

                        case 'utf8':
                        case 'utf-8':
                            return utf8Slice(this, start, end)

                        case 'ascii':
                            return asciiSlice(this, start, end)

                        case 'binary':
                            return binarySlice(this, start, end)

                        case 'base64':
                            return base64Slice(this, start, end)

                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return utf16leSlice(this, start, end)

                        default:
                            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                            encoding = (encoding + '').toLowerCase()
                            loweredCase = true
                    }
                }
            }

            Buffer.prototype.toString = function toString() {
                var length = this.length | 0
                if (length === 0) return ''
                if (arguments.length === 0) return utf8Slice(this, 0, length)
                return slowToString.apply(this, arguments)
            }

            Buffer.prototype.equals = function equals(b) {
                if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
                if (this === b) return true
                return Buffer.compare(this, b) === 0
            }

            Buffer.prototype.inspect = function inspect() {
                var str = ''
                var max = exports.INSPECT_MAX_BYTES
                if (this.length > 0) {
                    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
                    if (this.length > max) str += ' ... '
                }
                return '<Buffer ' + str + '>'
            }

            Buffer.prototype.compare = function compare(b) {
                if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
                if (this === b) return 0
                return Buffer.compare(this, b)
            }

            Buffer.prototype.indexOf = function indexOf(val, byteOffset) {
                if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
                else if (byteOffset < -0x80000000) byteOffset = -0x80000000
                byteOffset >>= 0

                if (this.length === 0) return -1
                if (byteOffset >= this.length) return -1

                // Negative offsets start from the end of the buffer
                if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

                if (typeof val === 'string') {
                    if (val.length === 0) return -1 // special case: looking for empty string always fails
                    return String.prototype.indexOf.call(this, val, byteOffset)
                }
                if (Buffer.isBuffer(val)) {
                    return arrayIndexOf(this, val, byteOffset)
                }
                if (typeof val === 'number') {
                    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
                        return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
                    }
                    return arrayIndexOf(this, [val], byteOffset)
                }

                function arrayIndexOf(arr, val, byteOffset) {
                    var foundIndex = -1
                    for (var i = 0; byteOffset + i < arr.length; i++) {
                        if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
                            if (foundIndex === -1) foundIndex = i
                            if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
                        } else {
                            foundIndex = -1
                        }
                    }
                    return -1
                }

                throw new TypeError('val must be string, number or Buffer')
            }

// `get` is deprecated
            Buffer.prototype.get = function get(offset) {
                console.log('.get() is deprecated. Access using array indexes instead.')
                return this.readUInt8(offset)
            }

// `set` is deprecated
            Buffer.prototype.set = function set(v, offset) {
                console.log('.set() is deprecated. Access using array indexes instead.')
                return this.writeUInt8(v, offset)
            }

            function hexWrite(buf, string, offset, length) {
                offset = Number(offset) || 0
                var remaining = buf.length - offset
                if (!length) {
                    length = remaining
                } else {
                    length = Number(length)
                    if (length > remaining) {
                        length = remaining
                    }
                }

                // must be an even number of digits
                var strLen = string.length
                if (strLen % 2 !== 0) throw new Error('Invalid hex string')

                if (length > strLen / 2) {
                    length = strLen / 2
                }
                for (var i = 0; i < length; i++) {
                    var parsed = parseInt(string.substr(i * 2, 2), 16)
                    if (isNaN(parsed)) throw new Error('Invalid hex string')
                    buf[offset + i] = parsed
                }
                return i
            }

            function utf8Write(buf, string, offset, length) {
                return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
            }

            function asciiWrite(buf, string, offset, length) {
                return blitBuffer(asciiToBytes(string), buf, offset, length)
            }

            function binaryWrite(buf, string, offset, length) {
                return asciiWrite(buf, string, offset, length)
            }

            function base64Write(buf, string, offset, length) {
                return blitBuffer(base64ToBytes(string), buf, offset, length)
            }

            function ucs2Write(buf, string, offset, length) {
                return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
            }

            Buffer.prototype.write = function write(string, offset, length, encoding) {
                // Buffer#write(string)
                if (offset === undefined) {
                    encoding = 'utf8'
                    length = this.length
                    offset = 0
                    // Buffer#write(string, encoding)
                } else if (length === undefined && typeof offset === 'string') {
                    encoding = offset
                    length = this.length
                    offset = 0
                    // Buffer#write(string, offset[, length][, encoding])
                } else if (isFinite(offset)) {
                    offset = offset | 0
                    if (isFinite(length)) {
                        length = length | 0
                        if (encoding === undefined) encoding = 'utf8'
                    } else {
                        encoding = length
                        length = undefined
                    }
                    // legacy write(string, encoding, offset, length) - remove in v0.13
                } else {
                    var swap = encoding
                    encoding = offset
                    offset = length | 0
                    length = swap
                }

                var remaining = this.length - offset
                if (length === undefined || length > remaining) length = remaining

                if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                    throw new RangeError('attempt to write outside buffer bounds')
                }

                if (!encoding) encoding = 'utf8'

                var loweredCase = false
                for (; ;) {
                    switch (encoding) {
                        case 'hex':
                            return hexWrite(this, string, offset, length)

                        case 'utf8':
                        case 'utf-8':
                            return utf8Write(this, string, offset, length)

                        case 'ascii':
                            return asciiWrite(this, string, offset, length)

                        case 'binary':
                            return binaryWrite(this, string, offset, length)

                        case 'base64':
                            // Warning: maxLength not taken into account in base64Write
                            return base64Write(this, string, offset, length)

                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return ucs2Write(this, string, offset, length)

                        default:
                            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                            encoding = ('' + encoding).toLowerCase()
                            loweredCase = true
                    }
                }
            }

            Buffer.prototype.toJSON = function toJSON() {
                return {
                    type: 'Buffer',
                    data: Array.prototype.slice.call(this._arr || this, 0)
                }
            }

            function base64Slice(buf, start, end) {
                if (start === 0 && end === buf.length) {
                    return base64.fromByteArray(buf)
                } else {
                    return base64.fromByteArray(buf.slice(start, end))
                }
            }

            function utf8Slice(buf, start, end) {
                end = Math.min(buf.length, end)
                var res = []

                var i = start
                while (i < end) {
                    var firstByte = buf[i]
                    var codePoint = null
                    var bytesPerSequence = (firstByte > 0xEF) ? 4
                        : (firstByte > 0xDF) ? 3
                            : (firstByte > 0xBF) ? 2
                                : 1

                    if (i + bytesPerSequence <= end) {
                        var secondByte, thirdByte, fourthByte, tempCodePoint

                        switch (bytesPerSequence) {
                            case 1:
                                if (firstByte < 0x80) {
                                    codePoint = firstByte
                                }
                                break
                            case 2:
                                secondByte = buf[i + 1]
                                if ((secondByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                                    if (tempCodePoint > 0x7F) {
                                        codePoint = tempCodePoint
                                    }
                                }
                                break
                            case 3:
                                secondByte = buf[i + 1]
                                thirdByte = buf[i + 2]
                                if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                                    if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                        codePoint = tempCodePoint
                                    }
                                }
                                break
                            case 4:
                                secondByte = buf[i + 1]
                                thirdByte = buf[i + 2]
                                fourthByte = buf[i + 3]
                                if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                                    if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                        codePoint = tempCodePoint
                                    }
                                }
                        }
                    }

                    if (codePoint === null) {
                        // we did not generate a valid codePoint so insert a
                        // replacement char (U+FFFD) and advance only 1 byte
                        codePoint = 0xFFFD
                        bytesPerSequence = 1
                    } else if (codePoint > 0xFFFF) {
                        // encode to utf16 (surrogate pair dance)
                        codePoint -= 0x10000
                        res.push(codePoint >>> 10 & 0x3FF | 0xD800)
                        codePoint = 0xDC00 | codePoint & 0x3FF
                    }

                    res.push(codePoint)
                    i += bytesPerSequence
                }

                return decodeCodePointsArray(res)
            }

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
            var MAX_ARGUMENTS_LENGTH = 0x1000

            function decodeCodePointsArray(codePoints) {
                var len = codePoints.length
                if (len <= MAX_ARGUMENTS_LENGTH) {
                    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
                }

                // Decode in chunks to avoid "call stack size exceeded".
                var res = ''
                var i = 0
                while (i < len) {
                    res += String.fromCharCode.apply(
                        String,
                        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                    )
                }
                return res
            }

            function asciiSlice(buf, start, end) {
                var ret = ''
                end = Math.min(buf.length, end)

                for (var i = start; i < end; i++) {
                    ret += String.fromCharCode(buf[i] & 0x7F)
                }
                return ret
            }

            function binarySlice(buf, start, end) {
                var ret = ''
                end = Math.min(buf.length, end)

                for (var i = start; i < end; i++) {
                    ret += String.fromCharCode(buf[i])
                }
                return ret
            }

            function hexSlice(buf, start, end) {
                var len = buf.length

                if (!start || start < 0) start = 0
                if (!end || end < 0 || end > len) end = len

                var out = ''
                for (var i = start; i < end; i++) {
                    out += toHex(buf[i])
                }
                return out
            }

            function utf16leSlice(buf, start, end) {
                var bytes = buf.slice(start, end)
                var res = ''
                for (var i = 0; i < bytes.length; i += 2) {
                    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
                }
                return res
            }

            Buffer.prototype.slice = function slice(start, end) {
                var len = this.length
                start = ~~start
                end = end === undefined ? len : ~~end

                if (start < 0) {
                    start += len
                    if (start < 0) start = 0
                } else if (start > len) {
                    start = len
                }

                if (end < 0) {
                    end += len
                    if (end < 0) end = 0
                } else if (end > len) {
                    end = len
                }

                if (end < start) end = start

                var newBuf
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    newBuf = Buffer._augment(this.subarray(start, end))
                } else {
                    var sliceLen = end - start
                    newBuf = new Buffer(sliceLen, undefined)
                    for (var i = 0; i < sliceLen; i++) {
                        newBuf[i] = this[i + start]
                    }
                }

                if (newBuf.length) newBuf.parent = this.parent || this

                return newBuf
            }

            /*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
            function checkOffset(offset, ext, length) {
                if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
                if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
            }

            Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var val = this[offset]
                var mul = 1
                var i = 0
                while (++i < byteLength && (mul *= 0x100)) {
                    val += this[offset + i] * mul
                }

                return val
            }

            Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) {
                    checkOffset(offset, byteLength, this.length)
                }

                var val = this[offset + --byteLength]
                var mul = 1
                while (byteLength > 0 && (mul *= 0x100)) {
                    val += this[offset + --byteLength] * mul
                }

                return val
            }

            Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 1, this.length)
                return this[offset]
            }

            Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                return this[offset] | (this[offset + 1] << 8)
            }

            Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                return (this[offset] << 8) | this[offset + 1]
            }

            Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return ((this[offset]) |
                    (this[offset + 1] << 8) |
                    (this[offset + 2] << 16)) +
                    (this[offset + 3] * 0x1000000)
            }

            Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset] * 0x1000000) +
                    ((this[offset + 1] << 16) |
                        (this[offset + 2] << 8) |
                        this[offset + 3])
            }

            Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var val = this[offset]
                var mul = 1
                var i = 0
                while (++i < byteLength && (mul *= 0x100)) {
                    val += this[offset + i] * mul
                }
                mul *= 0x80

                if (val >= mul) val -= Math.pow(2, 8 * byteLength)

                return val
            }

            Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var i = byteLength
                var mul = 1
                var val = this[offset + --i]
                while (i > 0 && (mul *= 0x100)) {
                    val += this[offset + --i] * mul
                }
                mul *= 0x80

                if (val >= mul) val -= Math.pow(2, 8 * byteLength)

                return val
            }

            Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 1, this.length)
                if (!(this[offset] & 0x80)) return (this[offset])
                return ((0xff - this[offset] + 1) * -1)
            }

            Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                var val = this[offset] | (this[offset + 1] << 8)
                return (val & 0x8000) ? val | 0xFFFF0000 : val
            }

            Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                var val = this[offset + 1] | (this[offset] << 8)
                return (val & 0x8000) ? val | 0xFFFF0000 : val
            }

            Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset]) |
                    (this[offset + 1] << 8) |
                    (this[offset + 2] << 16) |
                    (this[offset + 3] << 24)
            }

            Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset] << 24) |
                    (this[offset + 1] << 16) |
                    (this[offset + 2] << 8) |
                    (this[offset + 3])
            }

            Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)
                return ieee754.read(this, offset, true, 23, 4)
            }

            Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)
                return ieee754.read(this, offset, false, 23, 4)
            }

            Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 8, this.length)
                return ieee754.read(this, offset, true, 52, 8)
            }

            Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 8, this.length)
                return ieee754.read(this, offset, false, 52, 8)
            }

            function checkInt(buf, value, offset, ext, max, min) {
                if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
                if (value > max || value < min) throw new RangeError('value is out of bounds')
                if (offset + ext > buf.length) throw new RangeError('index out of range')
            }

            Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

                var mul = 1
                var i = 0
                this[offset] = value & 0xFF
                while (++i < byteLength && (mul *= 0x100)) {
                    this[offset + i] = (value / mul) & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

                var i = byteLength - 1
                var mul = 1
                this[offset + i] = value & 0xFF
                while (--i >= 0 && (mul *= 0x100)) {
                    this[offset + i] = (value / mul) & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
                if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                this[offset] = (value & 0xff)
                return offset + 1
            }

            function objectWriteUInt16(buf, value, offset, littleEndian) {
                if (value < 0) value = 0xffff + value + 1
                for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
                    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                        (littleEndian ? i : 1 - i) * 8
                }
            }

            Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                } else {
                    objectWriteUInt16(this, value, offset, true)
                }
                return offset + 2
            }

            Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 8)
                    this[offset + 1] = (value & 0xff)
                } else {
                    objectWriteUInt16(this, value, offset, false)
                }
                return offset + 2
            }

            function objectWriteUInt32(buf, value, offset, littleEndian) {
                if (value < 0) value = 0xffffffff + value + 1
                for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
                    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
                }
            }

            Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset + 3] = (value >>> 24)
                    this[offset + 2] = (value >>> 16)
                    this[offset + 1] = (value >>> 8)
                    this[offset] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, true)
                }
                return offset + 4
            }

            Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 24)
                    this[offset + 1] = (value >>> 16)
                    this[offset + 2] = (value >>> 8)
                    this[offset + 3] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, false)
                }
                return offset + 4
            }

            Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) {
                    var limit = Math.pow(2, 8 * byteLength - 1)

                    checkInt(this, value, offset, byteLength, limit - 1, -limit)
                }

                var i = 0
                var mul = 1
                var sub = value < 0 ? 1 : 0
                this[offset] = value & 0xFF
                while (++i < byteLength && (mul *= 0x100)) {
                    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) {
                    var limit = Math.pow(2, 8 * byteLength - 1)

                    checkInt(this, value, offset, byteLength, limit - 1, -limit)
                }

                var i = byteLength - 1
                var mul = 1
                var sub = value < 0 ? 1 : 0
                this[offset + i] = value & 0xFF
                while (--i >= 0 && (mul *= 0x100)) {
                    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
                if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                if (value < 0) value = 0xff + value + 1
                this[offset] = (value & 0xff)
                return offset + 1
            }

            Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                } else {
                    objectWriteUInt16(this, value, offset, true)
                }
                return offset + 2
            }

            Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 8)
                    this[offset + 1] = (value & 0xff)
                } else {
                    objectWriteUInt16(this, value, offset, false)
                }
                return offset + 2
            }

            Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                    this[offset + 2] = (value >>> 16)
                    this[offset + 3] = (value >>> 24)
                } else {
                    objectWriteUInt32(this, value, offset, true)
                }
                return offset + 4
            }

            Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                if (value < 0) value = 0xffffffff + value + 1
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 24)
                    this[offset + 1] = (value >>> 16)
                    this[offset + 2] = (value >>> 8)
                    this[offset + 3] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, false)
                }
                return offset + 4
            }

            function checkIEEE754(buf, value, offset, ext, max, min) {
                if (value > max || value < min) throw new RangeError('value is out of bounds')
                if (offset + ext > buf.length) throw new RangeError('index out of range')
                if (offset < 0) throw new RangeError('index out of range')
            }

            function writeFloat(buf, value, offset, littleEndian, noAssert) {
                if (!noAssert) {
                    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
                }
                ieee754.write(buf, value, offset, littleEndian, 23, 4)
                return offset + 4
            }

            Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
                return writeFloat(this, value, offset, true, noAssert)
            }

            Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
                return writeFloat(this, value, offset, false, noAssert)
            }

            function writeDouble(buf, value, offset, littleEndian, noAssert) {
                if (!noAssert) {
                    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
                }
                ieee754.write(buf, value, offset, littleEndian, 52, 8)
                return offset + 8
            }

            Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
                return writeDouble(this, value, offset, true, noAssert)
            }

            Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
                return writeDouble(this, value, offset, false, noAssert)
            }

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
            Buffer.prototype.copy = function copy(target, targetStart, start, end) {
                if (!start) start = 0
                if (!end && end !== 0) end = this.length
                if (targetStart >= target.length) targetStart = target.length
                if (!targetStart) targetStart = 0
                if (end > 0 && end < start) end = start

                // Copy 0 bytes; we're done
                if (end === start) return 0
                if (target.length === 0 || this.length === 0) return 0

                // Fatal error conditions
                if (targetStart < 0) {
                    throw new RangeError('targetStart out of bounds')
                }
                if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
                if (end < 0) throw new RangeError('sourceEnd out of bounds')

                // Are we oob?
                if (end > this.length) end = this.length
                if (target.length - targetStart < end - start) {
                    end = target.length - targetStart + start
                }

                var len = end - start
                var i

                if (this === target && start < targetStart && targetStart < end) {
                    // descending copy from end
                    for (i = len - 1; i >= 0; i--) {
                        target[i + targetStart] = this[i + start]
                    }
                } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                    // ascending copy from start
                    for (i = 0; i < len; i++) {
                        target[i + targetStart] = this[i + start]
                    }
                } else {
                    target._set(this.subarray(start, start + len), targetStart)
                }

                return len
            }

// fill(value, start=0, end=buffer.length)
            Buffer.prototype.fill = function fill(value, start, end) {
                if (!value) value = 0
                if (!start) start = 0
                if (!end) end = this.length

                if (end < start) throw new RangeError('end < start')

                // Fill 0 bytes; we're done
                if (end === start) return
                if (this.length === 0) return

                if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
                if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

                var i
                if (typeof value === 'number') {
                    for (i = start; i < end; i++) {
                        this[i] = value
                    }
                } else {
                    var bytes = utf8ToBytes(value.toString())
                    var len = bytes.length
                    for (i = start; i < end; i++) {
                        this[i] = bytes[i % len]
                    }
                }

                return this
            }

            /**
             * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
             * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
             */
            Buffer.prototype.toArrayBuffer = function toArrayBuffer() {
                if (typeof Uint8Array !== 'undefined') {
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        return (new Buffer(this)).buffer
                    } else {
                        var buf = new Uint8Array(this.length)
                        for (var i = 0, len = buf.length; i < len; i += 1) {
                            buf[i] = this[i]
                        }
                        return buf.buffer
                    }
                } else {
                    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
                }
            }

// HELPER FUNCTIONS
// ================

            var BP = Buffer.prototype

            /**
             * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
             */
            Buffer._augment = function _augment(arr) {
                arr.constructor = Buffer
                arr._isBuffer = true

                // save reference to original Uint8Array set method before overwriting
                arr._set = arr.set

                // deprecated
                arr.get = BP.get
                arr.set = BP.set

                arr.write = BP.write
                arr.toString = BP.toString
                arr.toLocaleString = BP.toString
                arr.toJSON = BP.toJSON
                arr.equals = BP.equals
                arr.compare = BP.compare
                arr.indexOf = BP.indexOf
                arr.copy = BP.copy
                arr.slice = BP.slice
                arr.readUIntLE = BP.readUIntLE
                arr.readUIntBE = BP.readUIntBE
                arr.readUInt8 = BP.readUInt8
                arr.readUInt16LE = BP.readUInt16LE
                arr.readUInt16BE = BP.readUInt16BE
                arr.readUInt32LE = BP.readUInt32LE
                arr.readUInt32BE = BP.readUInt32BE
                arr.readIntLE = BP.readIntLE
                arr.readIntBE = BP.readIntBE
                arr.readInt8 = BP.readInt8
                arr.readInt16LE = BP.readInt16LE
                arr.readInt16BE = BP.readInt16BE
                arr.readInt32LE = BP.readInt32LE
                arr.readInt32BE = BP.readInt32BE
                arr.readFloatLE = BP.readFloatLE
                arr.readFloatBE = BP.readFloatBE
                arr.readDoubleLE = BP.readDoubleLE
                arr.readDoubleBE = BP.readDoubleBE
                arr.writeUInt8 = BP.writeUInt8
                arr.writeUIntLE = BP.writeUIntLE
                arr.writeUIntBE = BP.writeUIntBE
                arr.writeUInt16LE = BP.writeUInt16LE
                arr.writeUInt16BE = BP.writeUInt16BE
                arr.writeUInt32LE = BP.writeUInt32LE
                arr.writeUInt32BE = BP.writeUInt32BE
                arr.writeIntLE = BP.writeIntLE
                arr.writeIntBE = BP.writeIntBE
                arr.writeInt8 = BP.writeInt8
                arr.writeInt16LE = BP.writeInt16LE
                arr.writeInt16BE = BP.writeInt16BE
                arr.writeInt32LE = BP.writeInt32LE
                arr.writeInt32BE = BP.writeInt32BE
                arr.writeFloatLE = BP.writeFloatLE
                arr.writeFloatBE = BP.writeFloatBE
                arr.writeDoubleLE = BP.writeDoubleLE
                arr.writeDoubleBE = BP.writeDoubleBE
                arr.fill = BP.fill
                arr.inspect = BP.inspect
                arr.toArrayBuffer = BP.toArrayBuffer

                return arr
            }

            var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

            function base64clean(str) {
                // Node strips out invalid characters like \n and \t from the string, base64-js does not
                str = stringtrim(str).replace(INVALID_BASE64_RE, '')
                // Node converts strings with length < 2 to ''
                if (str.length < 2) return ''
                // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
                while (str.length % 4 !== 0) {
                    str = str + '='
                }
                return str
            }

            function stringtrim(str) {
                if (str.trim) return str.trim()
                return str.replace(/^\s+|\s+$/g, '')
            }

            function toHex(n) {
                if (n < 16) return '0' + n.toString(16)
                return n.toString(16)
            }

            function utf8ToBytes(string, units) {
                units = units || Infinity
                var codePoint
                var length = string.length
                var leadSurrogate = null
                var bytes = []

                for (var i = 0; i < length; i++) {
                    codePoint = string.charCodeAt(i)

                    // is surrogate component
                    if (codePoint > 0xD7FF && codePoint < 0xE000) {
                        // last char was a lead
                        if (!leadSurrogate) {
                            // no lead yet
                            if (codePoint > 0xDBFF) {
                                // unexpected trail
                                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                continue
                            } else if (i + 1 === length) {
                                // unpaired lead
                                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                continue
                            }

                            // valid lead
                            leadSurrogate = codePoint

                            continue
                        }

                        // 2 leads in a row
                        if (codePoint < 0xDC00) {
                            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                            leadSurrogate = codePoint
                            continue
                        }

                        // valid surrogate pair
                        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
                    } else if (leadSurrogate) {
                        // valid bmp char, but last char was a lead
                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                    }

                    leadSurrogate = null

                    // encode utf8
                    if (codePoint < 0x80) {
                        if ((units -= 1) < 0) break
                        bytes.push(codePoint)
                    } else if (codePoint < 0x800) {
                        if ((units -= 2) < 0) break
                        bytes.push(
                            codePoint >> 0x6 | 0xC0,
                            codePoint & 0x3F | 0x80
                        )
                    } else if (codePoint < 0x10000) {
                        if ((units -= 3) < 0) break
                        bytes.push(
                            codePoint >> 0xC | 0xE0,
                            codePoint >> 0x6 & 0x3F | 0x80,
                            codePoint & 0x3F | 0x80
                        )
                    } else if (codePoint < 0x110000) {
                        if ((units -= 4) < 0) break
                        bytes.push(
                            codePoint >> 0x12 | 0xF0,
                            codePoint >> 0xC & 0x3F | 0x80,
                            codePoint >> 0x6 & 0x3F | 0x80,
                            codePoint & 0x3F | 0x80
                        )
                    } else {
                        throw new Error('Invalid code point')
                    }
                }

                return bytes
            }

            function asciiToBytes(str) {
                var byteArray = []
                for (var i = 0; i < str.length; i++) {
                    // Node's code seems to be doing this and not & 0x7F..
                    byteArray.push(str.charCodeAt(i) & 0xFF)
                }
                return byteArray
            }

            function utf16leToBytes(str, units) {
                var c, hi, lo
                var byteArray = []
                for (var i = 0; i < str.length; i++) {
                    if ((units -= 2) < 0) break

                    c = str.charCodeAt(i)
                    hi = c >> 8
                    lo = c % 256
                    byteArray.push(lo)
                    byteArray.push(hi)
                }

                return byteArray
            }

            function base64ToBytes(str) {
                return base64.toByteArray(base64clean(str))
            }

            function blitBuffer(src, dst, offset, length) {
                for (var i = 0; i < length; i++) {
                    if ((i + offset >= dst.length) || (i >= src.length)) break
                    dst[i + offset] = src[i]
                }
                return i
            }

        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {"base64-js": 2, "ieee754": 3, "is-array": 4}], 2: [function (require, module, exports) {
        var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

        ;(function (exports) {
            'use strict';

            var Arr = (typeof Uint8Array !== 'undefined')
                ? Uint8Array
                : Array

            var PLUS = '+'.charCodeAt(0)
            var SLASH = '/'.charCodeAt(0)
            var NUMBER = '0'.charCodeAt(0)
            var LOWER = 'a'.charCodeAt(0)
            var UPPER = 'A'.charCodeAt(0)
            var PLUS_URL_SAFE = '-'.charCodeAt(0)
            var SLASH_URL_SAFE = '_'.charCodeAt(0)

            function decode(elt) {
                var code = elt.charCodeAt(0)
                if (code === PLUS ||
                    code === PLUS_URL_SAFE)
                    return 62 // '+'
                if (code === SLASH ||
                    code === SLASH_URL_SAFE)
                    return 63 // '/'
                if (code < NUMBER)
                    return -1 //no match
                if (code < NUMBER + 10)
                    return code - NUMBER + 26 + 26
                if (code < UPPER + 26)
                    return code - UPPER
                if (code < LOWER + 26)
                    return code - LOWER + 26
            }

            function b64ToByteArray(b64) {
                var i, j, l, tmp, placeHolders, arr

                if (b64.length % 4 > 0) {
                    throw new Error('Invalid string. Length must be a multiple of 4')
                }

                // the number of equal signs (place holders)
                // if there are two placeholders, than the two characters before it
                // represent one byte
                // if there is only one, then the three characters before it represent 2 bytes
                // this is just a cheap hack to not do indexOf twice
                var len = b64.length
                placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

                // base64 is 4/3 + up to two characters of the original data
                arr = new Arr(b64.length * 3 / 4 - placeHolders)

                // if there are placeholders, only get up to the last complete 4 chars
                l = placeHolders > 0 ? b64.length - 4 : b64.length

                var L = 0

                function push(v) {
                    arr[L++] = v
                }

                for (i = 0, j = 0; i < l; i += 4, j += 3) {
                    tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
                    push((tmp & 0xFF0000) >> 16)
                    push((tmp & 0xFF00) >> 8)
                    push(tmp & 0xFF)
                }

                if (placeHolders === 2) {
                    tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
                    push(tmp & 0xFF)
                } else if (placeHolders === 1) {
                    tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
                    push((tmp >> 8) & 0xFF)
                    push(tmp & 0xFF)
                }

                return arr
            }

            function uint8ToBase64(uint8) {
                var i,
                    extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
                    output = "",
                    temp, length

                function encode(num) {
                    return lookup.charAt(num)
                }

                function tripletToBase64(num) {
                    return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
                }

                // go through the array every three bytes, we'll deal with trailing stuff later
                for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
                    temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
                    output += tripletToBase64(temp)
                }

                // pad the end with zeros, but make sure to not forget the extra bytes
                switch (extraBytes) {
                    case 1:
                        temp = uint8[uint8.length - 1]
                        output += encode(temp >> 2)
                        output += encode((temp << 4) & 0x3F)
                        output += '=='
                        break
                    case 2:
                        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
                        output += encode(temp >> 10)
                        output += encode((temp >> 4) & 0x3F)
                        output += encode((temp << 2) & 0x3F)
                        output += '='
                        break
                }

                return output
            }

            exports.toByteArray = b64ToByteArray
            exports.fromByteArray = uint8ToBase64
        }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

    }, {}], 3: [function (require, module, exports) {
        exports.read = function (buffer, offset, isLE, mLen, nBytes) {
            var e, m
            var eLen = nBytes * 8 - mLen - 1
            var eMax = (1 << eLen) - 1
            var eBias = eMax >> 1
            var nBits = -7
            var i = isLE ? (nBytes - 1) : 0
            var d = isLE ? -1 : 1
            var s = buffer[offset + i]

            i += d

            e = s & ((1 << (-nBits)) - 1)
            s >>= (-nBits)
            nBits += eLen
            for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
            }

            m = e & ((1 << (-nBits)) - 1)
            e >>= (-nBits)
            nBits += mLen
            for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
            }

            if (e === 0) {
                e = 1 - eBias
            } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity)
            } else {
                m = m + Math.pow(2, mLen)
                e = e - eBias
            }
            return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
        }

        exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
            var e, m, c
            var eLen = nBytes * 8 - mLen - 1
            var eMax = (1 << eLen) - 1
            var eBias = eMax >> 1
            var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
            var i = isLE ? 0 : (nBytes - 1)
            var d = isLE ? 1 : -1
            var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

            value = Math.abs(value)

            if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0
                e = eMax
            } else {
                e = Math.floor(Math.log(value) / Math.LN2)
                if (value * (c = Math.pow(2, -e)) < 1) {
                    e--
                    c *= 2
                }
                if (e + eBias >= 1) {
                    value += rt / c
                } else {
                    value += rt * Math.pow(2, 1 - eBias)
                }
                if (value * c >= 2) {
                    e++
                    c /= 2
                }

                if (e + eBias >= eMax) {
                    m = 0
                    e = eMax
                } else if (e + eBias >= 1) {
                    m = (value * c - 1) * Math.pow(2, mLen)
                    e = e + eBias
                } else {
                    m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
                    e = 0
                }
            }

            for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {
            }

            e = (e << mLen) | m
            eLen += mLen
            for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {
            }

            buffer[offset + i - d] |= s * 128
        }

    }, {}], 4: [function (require, module, exports) {

        /**
         * isArray
         */

        var isArray = Array.isArray;

        /**
         * toString
         */

        var str = Object.prototype.toString;

        /**
         * Whether or not the given `val`
         * is an array.
         *
         * example:
         *
         *        isArray([]);
         *        // > true
         *        isArray(arguments);
         *        // > false
         *        isArray('');
         *        // > false
         *
         * @param {mixed} val
         * @return {bool}
         */

        module.exports = isArray || function (val) {
            return !!val && '[object Array]' == str.call(val);
        };

    }, {}], 5: [function (require, module, exports) {
        if (typeof Object.create === 'function') {
            // implementation from standard node.js 'util' module
            module.exports = function inherits(ctor, superCtor) {
                ctor.super_ = superCtor
                ctor.prototype = Object.create(superCtor.prototype, {
                    constructor: {
                        value: ctor,
                        enumerable: false,
                        writable: true,
                        configurable: true
                    }
                });
            };
        } else {
            // old school shim for old browsers
            module.exports = function inherits(ctor, superCtor) {
                ctor.super_ = superCtor
                var TempCtor = function () {
                }
                TempCtor.prototype = superCtor.prototype
                ctor.prototype = new TempCtor()
                ctor.prototype.constructor = ctor
            }
        }

    }, {}], 6: [function (require, module, exports) {
// shim for using process in browser

        var process = module.exports = {};
        var queue = [];
        var draining = false;
        var currentQueue;
        var queueIndex = -1;

        function cleanUpNextTick() {
            draining = false;
            if (currentQueue.length) {
                queue = currentQueue.concat(queue);
            } else {
                queueIndex = -1;
            }
            if (queue.length) {
                drainQueue();
            }
        }

        function drainQueue() {
            if (draining) {
                return;
            }
            var timeout = setTimeout(cleanUpNextTick);
            draining = true;

            var len = queue.length;
            while (len) {
                currentQueue = queue;
                queue = [];
                while (++queueIndex < len) {
                    if (currentQueue) {
                        currentQueue[queueIndex].run();
                    }
                }
                queueIndex = -1;
                len = queue.length;
            }
            currentQueue = null;
            draining = false;
            clearTimeout(timeout);
        }

        process.nextTick = function (fun) {
            var args = new Array(arguments.length - 1);
            if (arguments.length > 1) {
                for (var i = 1; i < arguments.length; i++) {
                    args[i - 1] = arguments[i];
                }
            }
            queue.push(new Item(fun, args));
            if (queue.length === 1 && !draining) {
                setTimeout(drainQueue, 0);
            }
        };

// v8 likes predictible objects
        function Item(fun, array) {
            this.fun = fun;
            this.array = array;
        }

        Item.prototype.run = function () {
            this.fun.apply(null, this.array);
        };
        process.title = 'browser';
        process.browser = true;
        process.env = {};
        process.argv = [];
        process.version = ''; // empty string to avoid regexp issues
        process.versions = {};

        function noop() {
        }

        process.on = noop;
        process.addListener = noop;
        process.once = noop;
        process.off = noop;
        process.removeListener = noop;
        process.removeAllListeners = noop;
        process.emit = noop;

        process.binding = function (name) {
            throw new Error('process.binding is not supported');
        };

        process.cwd = function () {
            return '/'
        };
        process.chdir = function (dir) {
            throw new Error('process.chdir is not supported');
        };
        process.umask = function () {
            return 0;
        };

    }, {}], 7: [function (require, module, exports) {
        module.exports = function isBuffer(arg) {
            return arg && typeof arg === 'object'
                && typeof arg.copy === 'function'
                && typeof arg.fill === 'function'
                && typeof arg.readUInt8 === 'function';
        }
    }, {}], 8: [function (require, module, exports) {
        (function (process, global) {
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

            var formatRegExp = /%[sdj%]/g;
            exports.format = function (f) {
                if (!isString(f)) {
                    var objects = [];
                    for (var i = 0; i < arguments.length; i++) {
                        objects.push(inspect(arguments[i]));
                    }
                    return objects.join(' ');
                }

                var i = 1;
                var args = arguments;
                var len = args.length;
                var str = String(f).replace(formatRegExp, function (x) {
                    if (x === '%%') return '%';
                    if (i >= len) return x;
                    switch (x) {
                        case '%s':
                            return String(args[i++]);
                        case '%d':
                            return Number(args[i++]);
                        case '%j':
                            try {
                                return JSON.stringify(args[i++]);
                            } catch (_) {
                                return '[Circular]';
                            }
                        default:
                            return x;
                    }
                });
                for (var x = args[i]; i < len; x = args[++i]) {
                    if (isNull(x) || !isObject(x)) {
                        str += ' ' + x;
                    } else {
                        str += ' ' + inspect(x);
                    }
                }
                return str;
            };


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
            exports.deprecate = function (fn, msg) {
                // Allow for deprecating things in the process of starting up.
                if (isUndefined(global.process)) {
                    return function () {
                        return exports.deprecate(fn, msg).apply(this, arguments);
                    };
                }

                if (process.noDeprecation === true) {
                    return fn;
                }

                var warned = false;

                function deprecated() {
                    if (!warned) {
                        if (process.throwDeprecation) {
                            throw new Error(msg);
                        } else if (process.traceDeprecation) {
                            console.trace(msg);
                        } else {
                            console.error(msg);
                        }
                        warned = true;
                    }
                    return fn.apply(this, arguments);
                }

                return deprecated;
            };


            var debugs = {};
            var debugEnviron;
            exports.debuglog = function (set) {
                if (isUndefined(debugEnviron))
                    debugEnviron = process.env.NODE_DEBUG || '';
                set = set.toUpperCase();
                if (!debugs[set]) {
                    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
                        var pid = process.pid;
                        debugs[set] = function () {
                            var msg = exports.format.apply(exports, arguments);
                            console.error('%s %d: %s', set, pid, msg);
                        };
                    } else {
                        debugs[set] = function () {
                        };
                    }
                }
                return debugs[set];
            };


            /**
             * Echos the value of a value. Trys to print the value out
             * in the best way possible given the different types.
             *
             * @param {Object} obj The object to print out.
             * @param {Object} opts Optional options object that alters the output.
             */

            /* legacy: obj, showHidden, depth, colors*/
            function inspect(obj, opts) {
                // default options
                var ctx = {
                    seen: [],
                    stylize: stylizeNoColor
                };
                // legacy...
                if (arguments.length >= 3) ctx.depth = arguments[2];
                if (arguments.length >= 4) ctx.colors = arguments[3];
                if (isBoolean(opts)) {
                    // legacy...
                    ctx.showHidden = opts;
                } else if (opts) {
                    // got an "options" object
                    exports._extend(ctx, opts);
                }
                // set default options
                if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
                if (isUndefined(ctx.depth)) ctx.depth = 2;
                if (isUndefined(ctx.colors)) ctx.colors = false;
                if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
                if (ctx.colors) ctx.stylize = stylizeWithColor;
                return formatValue(ctx, obj, ctx.depth);
            }

            exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
            inspect.colors = {
                'bold': [1, 22],
                'italic': [3, 23],
                'underline': [4, 24],
                'inverse': [7, 27],
                'white': [37, 39],
                'grey': [90, 39],
                'black': [30, 39],
                'blue': [34, 39],
                'cyan': [36, 39],
                'green': [32, 39],
                'magenta': [35, 39],
                'red': [31, 39],
                'yellow': [33, 39]
            };

// Don't use 'blue' not visible on cmd.exe
            inspect.styles = {
                'special': 'cyan',
                'number': 'yellow',
                'boolean': 'yellow',
                'undefined': 'grey',
                'null': 'bold',
                'string': 'green',
                'date': 'magenta',
                // "name": intentionally not styling
                'regexp': 'red'
            };


            function stylizeWithColor(str, styleType) {
                var style = inspect.styles[styleType];

                if (style) {
                    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
                        '\u001b[' + inspect.colors[style][1] + 'm';
                } else {
                    return str;
                }
            }


            function stylizeNoColor(str, styleType) {
                return str;
            }


            function arrayToHash(array) {
                var hash = {};

                array.forEach(function (val, idx) {
                    hash[val] = true;
                });

                return hash;
            }


            function formatValue(ctx, value, recurseTimes) {
                // Provide a hook for user-specified inspect functions.
                // Check that value is an object with an inspect function on it
                if (ctx.customInspect &&
                    value &&
                    isFunction(value.inspect) &&
                    // Filter out the util module, it's inspect function is special
                    value.inspect !== exports.inspect &&
                    // Also filter out any prototype objects using the circular check.
                    !(value.constructor && value.constructor.prototype === value)) {
                    var ret = value.inspect(recurseTimes, ctx);
                    if (!isString(ret)) {
                        ret = formatValue(ctx, ret, recurseTimes);
                    }
                    return ret;
                }

                // Primitive types cannot have properties
                var primitive = formatPrimitive(ctx, value);
                if (primitive) {
                    return primitive;
                }

                // Look up the keys of the object.
                var keys = Object.keys(value);
                var visibleKeys = arrayToHash(keys);

                if (ctx.showHidden) {
                    keys = Object.getOwnPropertyNames(value);
                }

                // IE doesn't make error fields non-enumerable
                // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
                if (isError(value)
                    && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
                    return formatError(value);
                }

                // Some type of object without properties can be shortcutted.
                if (keys.length === 0) {
                    if (isFunction(value)) {
                        var name = value.name ? ': ' + value.name : '';
                        return ctx.stylize('[Function' + name + ']', 'special');
                    }
                    if (isRegExp(value)) {
                        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                    }
                    if (isDate(value)) {
                        return ctx.stylize(Date.prototype.toString.call(value), 'date');
                    }
                    if (isError(value)) {
                        return formatError(value);
                    }
                }

                var base = '', array = false, braces = ['{', '}'];

                // Make Array say that they are Array
                if (isArray(value)) {
                    array = true;
                    braces = ['[', ']'];
                }

                // Make functions say that they are functions
                if (isFunction(value)) {
                    var n = value.name ? ': ' + value.name : '';
                    base = ' [Function' + n + ']';
                }

                // Make RegExps say that they are RegExps
                if (isRegExp(value)) {
                    base = ' ' + RegExp.prototype.toString.call(value);
                }

                // Make dates with properties first say the date
                if (isDate(value)) {
                    base = ' ' + Date.prototype.toUTCString.call(value);
                }

                // Make error with message first say the error
                if (isError(value)) {
                    base = ' ' + formatError(value);
                }

                if (keys.length === 0 && (!array || value.length == 0)) {
                    return braces[0] + base + braces[1];
                }

                if (recurseTimes < 0) {
                    if (isRegExp(value)) {
                        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                    } else {
                        return ctx.stylize('[Object]', 'special');
                    }
                }

                ctx.seen.push(value);

                var output;
                if (array) {
                    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
                } else {
                    output = keys.map(function (key) {
                        return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
                    });
                }

                ctx.seen.pop();

                return reduceToSingleString(output, base, braces);
            }


            function formatPrimitive(ctx, value) {
                if (isUndefined(value))
                    return ctx.stylize('undefined', 'undefined');
                if (isString(value)) {
                    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                        .replace(/'/g, "\\'")
                        .replace(/\\"/g, '"') + '\'';
                    return ctx.stylize(simple, 'string');
                }
                if (isNumber(value))
                    return ctx.stylize('' + value, 'number');
                if (isBoolean(value))
                    return ctx.stylize('' + value, 'boolean');
                // For some reason typeof null is "object", so special case here.
                if (isNull(value))
                    return ctx.stylize('null', 'null');
            }


            function formatError(value) {
                return '[' + Error.prototype.toString.call(value) + ']';
            }


            function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
                var output = [];
                for (var i = 0, l = value.length; i < l; ++i) {
                    if (hasOwnProperty(value, String(i))) {
                        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                            String(i), true));
                    } else {
                        output.push('');
                    }
                }
                keys.forEach(function (key) {
                    if (!key.match(/^\d+$/)) {
                        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                            key, true));
                    }
                });
                return output;
            }


            function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
                var name, str, desc;
                desc = Object.getOwnPropertyDescriptor(value, key) || {value: value[key]};
                if (desc.get) {
                    if (desc.set) {
                        str = ctx.stylize('[Getter/Setter]', 'special');
                    } else {
                        str = ctx.stylize('[Getter]', 'special');
                    }
                } else {
                    if (desc.set) {
                        str = ctx.stylize('[Setter]', 'special');
                    }
                }
                if (!hasOwnProperty(visibleKeys, key)) {
                    name = '[' + key + ']';
                }
                if (!str) {
                    if (ctx.seen.indexOf(desc.value) < 0) {
                        if (isNull(recurseTimes)) {
                            str = formatValue(ctx, desc.value, null);
                        } else {
                            str = formatValue(ctx, desc.value, recurseTimes - 1);
                        }
                        if (str.indexOf('\n') > -1) {
                            if (array) {
                                str = str.split('\n').map(function (line) {
                                    return '  ' + line;
                                }).join('\n').substr(2);
                            } else {
                                str = '\n' + str.split('\n').map(function (line) {
                                    return '   ' + line;
                                }).join('\n');
                            }
                        }
                    } else {
                        str = ctx.stylize('[Circular]', 'special');
                    }
                }
                if (isUndefined(name)) {
                    if (array && key.match(/^\d+$/)) {
                        return str;
                    }
                    name = JSON.stringify('' + key);
                    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                        name = name.substr(1, name.length - 2);
                        name = ctx.stylize(name, 'name');
                    } else {
                        name = name.replace(/'/g, "\\'")
                            .replace(/\\"/g, '"')
                            .replace(/(^"|"$)/g, "'");
                        name = ctx.stylize(name, 'string');
                    }
                }

                return name + ': ' + str;
            }


            function reduceToSingleString(output, base, braces) {
                var numLinesEst = 0;
                var length = output.reduce(function (prev, cur) {
                    numLinesEst++;
                    if (cur.indexOf('\n') >= 0) numLinesEst++;
                    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
                }, 0);

                if (length > 60) {
                    return braces[0] +
                        (base === '' ? '' : base + '\n ') +
                        ' ' +
                        output.join(',\n  ') +
                        ' ' +
                        braces[1];
                }

                return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
            }


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
            function isArray(ar) {
                return Array.isArray(ar);
            }

            exports.isArray = isArray;

            function isBoolean(arg) {
                return typeof arg === 'boolean';
            }

            exports.isBoolean = isBoolean;

            function isNull(arg) {
                return arg === null;
            }

            exports.isNull = isNull;

            function isNullOrUndefined(arg) {
                return arg == null;
            }

            exports.isNullOrUndefined = isNullOrUndefined;

            function isNumber(arg) {
                return typeof arg === 'number';
            }

            exports.isNumber = isNumber;

            function isString(arg) {
                return typeof arg === 'string';
            }

            exports.isString = isString;

            function isSymbol(arg) {
                return typeof arg === 'symbol';
            }

            exports.isSymbol = isSymbol;

            function isUndefined(arg) {
                return arg === void 0;
            }

            exports.isUndefined = isUndefined;

            function isRegExp(re) {
                return isObject(re) && objectToString(re) === '[object RegExp]';
            }

            exports.isRegExp = isRegExp;

            function isObject(arg) {
                return typeof arg === 'object' && arg !== null;
            }

            exports.isObject = isObject;

            function isDate(d) {
                return isObject(d) && objectToString(d) === '[object Date]';
            }

            exports.isDate = isDate;

            function isError(e) {
                return isObject(e) &&
                    (objectToString(e) === '[object Error]' || e instanceof Error);
            }

            exports.isError = isError;

            function isFunction(arg) {
                return typeof arg === 'function';
            }

            exports.isFunction = isFunction;

            function isPrimitive(arg) {
                return arg === null ||
                    typeof arg === 'boolean' ||
                    typeof arg === 'number' ||
                    typeof arg === 'string' ||
                    typeof arg === 'symbol' ||  // ES6 symbol
                    typeof arg === 'undefined';
            }

            exports.isPrimitive = isPrimitive;

            exports.isBuffer = require('./support/isBuffer');

            function objectToString(o) {
                return Object.prototype.toString.call(o);
            }


            function pad(n) {
                return n < 10 ? '0' + n.toString(10) : n.toString(10);
            }


            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
            function timestamp() {
                var d = new Date();
                var time = [pad(d.getHours()),
                    pad(d.getMinutes()),
                    pad(d.getSeconds())].join(':');
                return [d.getDate(), months[d.getMonth()], time].join(' ');
            }


// log is just a thin wrapper to console.log that prepends a timestamp
            exports.log = function () {
                console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
            };


            /**
             * Inherit the prototype methods from one constructor into another.
             *
             * The Function.prototype.inherits from lang.js rewritten as a standalone
             * function (not on Function.prototype). NOTE: If this file is to be loaded
             * during bootstrapping this function needs to be rewritten using some native
             * functions as prototype setup using normal JavaScript does not work as
             * expected during bootstrapping (see mirror.js in r114903).
             *
             * @param {function} ctor Constructor function which needs to inherit the
             *     prototype.
             * @param {function} superCtor Constructor function to inherit prototype from.
             */
            exports.inherits = require('inherits');

            exports._extend = function (origin, add) {
                // Don't do anything if add isn't an object
                if (!add || !isObject(add)) return origin;

                var keys = Object.keys(add);
                var i = keys.length;
                while (i--) {
                    origin[keys[i]] = add[keys[i]];
                }
                return origin;
            };

            function hasOwnProperty(obj, prop) {
                return Object.prototype.hasOwnProperty.call(obj, prop);
            }

        }).call(this, require('_process'), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {"./support/isBuffer": 7, "_process": 6, "inherits": 5}], 9: [function (require, module, exports) {
        'use strict'

        /**
         Convert a bytes value to a more human-readable format. Choose between [metric or IEC units](https://en.wikipedia.org/wiki/Gigabyte), summarised below.

         Value | Metric
         ----- | -------------
         1000  | kB  kilobyte
         1000^2 | MB  megabyte
         1000^3 | GB  gigabyte
         1000^4 | TB  terabyte
         1000^5 | PB  petabyte
         1000^6 | EB  exabyte
         1000^7 | ZB  zettabyte
         1000^8 | YB  yottabyte

         Value | IEC
         ----- | ------------
         1024  | KiB kibibyte
         1024^2 | MiB mebibyte
         1024^3 | GiB gibibyte
         1024^4 | TiB tebibyte
         1024^5 | PiB pebibyte
         1024^6 | EiB exbibyte
         1024^7 | ZiB zebibyte
         1024^8 | YiB yobibyte

         @module byte-size
         */
        module.exports = byteSize

        /**
         @param {number} - the bytes value to convert
         @param [options] {object} - optional config
         @param [options.precision=1] {number} - number of decimal places
         @param [options.units=metric] {string} - select `"metric"` or `"iec"` units
         @returns {string}
         @alias module:byte-size
         @example
         ```js
         > var byteSize = require("byte-size")

         > byteSize(1580)
         '1.6 kB'

         > byteSize(1580, { units: 'iec' })
         '1.5 KiB'

         > byteSize(1580, { units: 'iec', precision: 3 })
         '1.543 KiB'

         > byteSize(1580, { units: 'iec', precision: 0 })
         '2 KiB'
         ```
         */
        function byteSize(bytes, options) {
            options = options || {}
            options.units = options.units || 'metric'
            options.precision = typeof options.precision === 'undefined' ? 1 : options.precision

            var table = [
                {expFrom: 0, expTo: 1, metric: 'B', iec: 'B'},
                {expFrom: 1, expTo: 2, metric: 'kB', iec: 'KiB'},
                {expFrom: 2, expTo: 3, metric: 'MB', iec: 'MiB'},
                {expFrom: 3, expTo: 4, metric: 'GB', iec: 'GiB'},
                {expFrom: 4, expTo: 5, metric: 'TB', iec: 'TiB'},
                {expFrom: 5, expTo: 6, metric: 'PB', iec: 'PiB'},
                {expFrom: 6, expTo: 7, metric: 'EB', iec: 'EiB'},
                {expFrom: 7, expTo: 8, metric: 'ZB', iec: 'ZiB'},
                {expFrom: 8, expTo: 9, metric: 'YB', iec: 'YiB'}
            ]

            var base = options.units === 'metric' ? 1000 : 1024

            for (var i = 0; i < table.length; i++) {
                var lower = Math.pow(base, table[i].expFrom)
                var upper = Math.pow(base, table[i].expTo)
                if (bytes >= lower && bytes < upper) {
                    var units = table[i][options.units]
                    if (i === 0) {
                        return bytes + ' ' + units
                    } else {
                        return (bytes / lower).toFixed(options.precision) + ' ' + units
                    }
                }
            }

            return bytes
        }

    }, {}], 10: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var util = require('./util');

            /**
             * A data structure which is a combination of an array and a set. Adding a new
             * member is O(1), testing for membership is O(1), and finding the index of an
             * element is O(1). Removing elements from the set is not supported. Only
             * strings are supported for membership.
             */
            function ArraySet() {
                this._array = [];
                this._set = {};
            }

            /**
             * Static method for creating ArraySet instances from an existing array.
             */
            ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
                var set = new ArraySet();
                for (var i = 0, len = aArray.length; i < len; i++) {
                    set.add(aArray[i], aAllowDuplicates);
                }
                return set;
            };

            /**
             * Return how many unique items are in this ArraySet. If duplicates have been
             * added, than those do not count towards the size.
             *
             * @returns Number
             */
            ArraySet.prototype.size = function ArraySet_size() {
                return Object.getOwnPropertyNames(this._set).length;
            };

            /**
             * Add the given string to this set.
             *
             * @param String aStr
             */
            ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
                var sStr = util.toSetString(aStr);
                var isDuplicate = this._set.hasOwnProperty(sStr);
                var idx = this._array.length;
                if (!isDuplicate || aAllowDuplicates) {
                    this._array.push(aStr);
                }
                if (!isDuplicate) {
                    this._set[sStr] = idx;
                }
            };

            /**
             * Is the given string a member of this set?
             *
             * @param String aStr
             */
            ArraySet.prototype.has = function ArraySet_has(aStr) {
                var sStr = util.toSetString(aStr);
                return this._set.hasOwnProperty(sStr);
            };

            /**
             * What is the index of the given string in the array?
             *
             * @param String aStr
             */
            ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
                var sStr = util.toSetString(aStr);
                if (this._set.hasOwnProperty(sStr)) {
                    return this._set[sStr];
                }
                throw new Error('"' + aStr + '" is not in the set.');
            };

            /**
             * What is the element at the given index?
             *
             * @param Number aIdx
             */
            ArraySet.prototype.at = function ArraySet_at(aIdx) {
                if (aIdx >= 0 && aIdx < this._array.length) {
                    return this._array[aIdx];
                }
                throw new Error('No element indexed by ' + aIdx);
            };

            /**
             * Returns the array representation of this set (which has the proper indices
             * indicated by indexOf). Note that this is a copy of the internal array used
             * for storing the members so that no one can mess with internal state.
             */
            ArraySet.prototype.toArray = function ArraySet_toArray() {
                return this._array.slice();
            };

            exports.ArraySet = ArraySet;
        }

    }, {"./util": 19}], 11: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
        {
            var base64 = require('./base64');

            // A single base 64 digit can contain 6 bits of data. For the base 64 variable
            // length quantities we use in the source map spec, the first bit is the sign,
            // the next four bits are the actual value, and the 6th bit is the
            // continuation bit. The continuation bit tells us whether there are more
            // digits in this value following this digit.
            //
            //   Continuation
            //   |    Sign
            //   |    |
            //   V    V
            //   101011

            var VLQ_BASE_SHIFT = 5;

            // binary: 100000
            var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

            // binary: 011111
            var VLQ_BASE_MASK = VLQ_BASE - 1;

            // binary: 100000
            var VLQ_CONTINUATION_BIT = VLQ_BASE;

            /**
             * Converts from a two-complement value to a value where the sign bit is
             * placed in the least significant bit.  For example, as decimals:
             *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
             *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
             */
            function toVLQSigned(aValue) {
                return aValue < 0
                    ? ((-aValue) << 1) + 1
                    : (aValue << 1) + 0;
            }

            /**
             * Converts to a two-complement value from a value where the sign bit is
             * placed in the least significant bit.  For example, as decimals:
             *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
             *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
             */
            function fromVLQSigned(aValue) {
                var isNegative = (aValue & 1) === 1;
                var shifted = aValue >> 1;
                return isNegative
                    ? -shifted
                    : shifted;
            }

            /**
             * Returns the base 64 VLQ encoded value.
             */
            exports.encode = function base64VLQ_encode(aValue) {
                var encoded = "";
                var digit;

                var vlq = toVLQSigned(aValue);

                do {
                    digit = vlq & VLQ_BASE_MASK;
                    vlq >>>= VLQ_BASE_SHIFT;
                    if (vlq > 0) {
                        // There are still more digits in this value, so we must make sure the
                        // continuation bit is marked.
                        digit |= VLQ_CONTINUATION_BIT;
                    }
                    encoded += base64.encode(digit);
                } while (vlq > 0);

                return encoded;
            };

            /**
             * Decodes the next base 64 VLQ value from the given string and returns the
             * value and the rest of the string via the out parameter.
             */
            exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
                var strLen = aStr.length;
                var result = 0;
                var shift = 0;
                var continuation, digit;

                do {
                    if (aIndex >= strLen) {
                        throw new Error("Expected more digits in base 64 VLQ value.");
                    }

                    digit = base64.decode(aStr.charCodeAt(aIndex++));
                    if (digit === -1) {
                        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
                    }

                    continuation = !!(digit & VLQ_CONTINUATION_BIT);
                    digit &= VLQ_BASE_MASK;
                    result = result + (digit << shift);
                    shift += VLQ_BASE_SHIFT;
                } while (continuation);

                aOutParam.value = fromVLQSigned(result);
                aOutParam.rest = aIndex;
            };
        }

    }, {"./base64": 12}], 12: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var intToCharMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

            /**
             * Encode an integer in the range of 0 to 63 to a single base 64 digit.
             */
            exports.encode = function (number) {
                if (0 <= number && number < intToCharMap.length) {
                    return intToCharMap[number];
                }
                throw new TypeError("Must be between 0 and 63: " + number);
            };

            /**
             * Decode a single base 64 character code digit to an integer. Returns -1 on
             * failure.
             */
            exports.decode = function (charCode) {
                var bigA = 65;     // 'A'
                var bigZ = 90;     // 'Z'

                var littleA = 97;  // 'a'
                var littleZ = 122; // 'z'

                var zero = 48;     // '0'
                var nine = 57;     // '9'

                var plus = 43;     // '+'
                var slash = 47;    // '/'

                var littleOffset = 26;
                var numberOffset = 52;

                // 0 - 25: ABCDEFGHIJKLMNOPQRSTUVWXYZ
                if (bigA <= charCode && charCode <= bigZ) {
                    return (charCode - bigA);
                }

                // 26 - 51: abcdefghijklmnopqrstuvwxyz
                if (littleA <= charCode && charCode <= littleZ) {
                    return (charCode - littleA + littleOffset);
                }

                // 52 - 61: 0123456789
                if (zero <= charCode && charCode <= nine) {
                    return (charCode - zero + numberOffset);
                }

                // 62: +
                if (charCode == plus) {
                    return 62;
                }

                // 63: /
                if (charCode == slash) {
                    return 63;
                }

                // Invalid base64 digit.
                return -1;
            };
        }

    }, {}], 13: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            exports.GREATEST_LOWER_BOUND = 1;
            exports.LEAST_UPPER_BOUND = 2;

            /**
             * Recursive implementation of binary search.
             *
             * @param aLow Indices here and lower do not contain the needle.
             * @param aHigh Indices here and higher do not contain the needle.
             * @param aNeedle The element being searched for.
             * @param aHaystack The non-empty array being searched.
             * @param aCompare Function which takes two elements and returns -1, 0, or 1.
             * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
             *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
             *     closest element that is smaller than or greater than the one we are
             *     searching for, respectively, if the exact element cannot be found.
             */
            function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
                // This function terminates when one of the following is true:
                //
                //   1. We find the exact element we are looking for.
                //
                //   2. We did not find the exact element, but we can return the index of
                //      the next-closest element.
                //
                //   3. We did not find the exact element, and there is no next-closest
                //      element than the one we are searching for, so we return -1.
                var mid = Math.floor((aHigh - aLow) / 2) + aLow;
                var cmp = aCompare(aNeedle, aHaystack[mid], true);
                if (cmp === 0) {
                    // Found the element we are looking for.
                    return mid;
                } else if (cmp > 0) {
                    // Our needle is greater than aHaystack[mid].
                    if (aHigh - mid > 1) {
                        // The element is in the upper half.
                        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
                    }

                    // The exact needle element was not found in this haystack. Determine if
                    // we are in termination case (3) or (2) and return the appropriate thing.
                    if (aBias == exports.LEAST_UPPER_BOUND) {
                        return aHigh < aHaystack.length ? aHigh : -1;
                    } else {
                        return mid;
                    }
                } else {
                    // Our needle is less than aHaystack[mid].
                    if (mid - aLow > 1) {
                        // The element is in the lower half.
                        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
                    }

                    // we are in termination case (3) or (2) and return the appropriate thing.
                    if (aBias == exports.LEAST_UPPER_BOUND) {
                        return mid;
                    } else {
                        return aLow < 0 ? -1 : aLow;
                    }
                }
            }

            /**
             * This is an implementation of binary search which will always try and return
             * the index of the closest element if there is no exact hit. This is because
             * mappings between original and generated line/col pairs are single points,
             * and there is an implicit region between each of them, so a miss just means
             * that you aren't on the very start of a region.
             *
             * @param aNeedle The element you are looking for.
             * @param aHaystack The array that is being searched.
             * @param aCompare A function which takes the needle and an element in the
             *     array and returns -1, 0, or 1 depending on whether the needle is less
             *     than, equal to, or greater than the element, respectively.
             * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
             *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
             *     closest element that is smaller than or greater than the one we are
             *     searching for, respectively, if the exact element cannot be found.
             *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
             */
            exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
                if (aHaystack.length === 0) {
                    return -1;
                }

                var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                    aCompare, aBias || exports.GREATEST_LOWER_BOUND);
                if (index < 0) {
                    return -1;
                }

                // We have found either the exact element, or the next-closest element than
                // the one we are searching for. However, there may be more than one such
                // element. Make sure we always return the smallest of these.
                while (index - 1 >= 0) {
                    if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
                        break;
                    }
                    --index;
                }

                return index;
            };
        }

    }, {}], 14: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var util = require('./util');

            /**
             * Determine whether mappingB is after mappingA with respect to generated
             * position.
             */
            function generatedPositionAfter(mappingA, mappingB) {
                // Optimized for most common case
                var lineA = mappingA.generatedLine;
                var lineB = mappingB.generatedLine;
                var columnA = mappingA.generatedColumn;
                var columnB = mappingB.generatedColumn;
                return lineB > lineA || lineB == lineA && columnB >= columnA ||
                    util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
            }

            /**
             * A data structure to provide a sorted view of accumulated mappings in a
             * performance conscious manner. It trades a neglibable overhead in general
             * case for a large speedup in case of mappings being added in order.
             */
            function MappingList() {
                this._array = [];
                this._sorted = true;
                // Serves as infimum
                this._last = {generatedLine: -1, generatedColumn: 0};
            }

            /**
             * Iterate through internal items. This method takes the same arguments that
             * `Array.prototype.forEach` takes.
             *
             * NOTE: The order of the mappings is NOT guaranteed.
             */
            MappingList.prototype.unsortedForEach =
                function MappingList_forEach(aCallback, aThisArg) {
                    this._array.forEach(aCallback, aThisArg);
                };

            /**
             * Add the given source mapping.
             *
             * @param Object aMapping
             */
            MappingList.prototype.add = function MappingList_add(aMapping) {
                if (generatedPositionAfter(this._last, aMapping)) {
                    this._last = aMapping;
                    this._array.push(aMapping);
                } else {
                    this._sorted = false;
                    this._array.push(aMapping);
                }
            };

            /**
             * Returns the flat, sorted array of mappings. The mappings are sorted by
             * generated position.
             *
             * WARNING: This method returns internal data without copying, for
             * performance. The return value must NOT be mutated, and should be treated as
             * an immutable borrow. If you want to take ownership, you must make your own
             * copy.
             */
            MappingList.prototype.toArray = function MappingList_toArray() {
                if (!this._sorted) {
                    this._array.sort(util.compareByGeneratedPositionsInflated);
                    this._sorted = true;
                }
                return this._array;
            };

            exports.MappingList = MappingList;
        }

    }, {"./util": 19}], 15: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            // It turns out that some (most?) JavaScript engines don't self-host
            // `Array.prototype.sort`. This makes sense because C++ will likely remain
            // faster than JS when doing raw CPU-intensive sorting. However, when using a
            // custom comparator function, calling back and forth between the VM's C++ and
            // JIT'd JS is rather slow *and* loses JIT type information, resulting in
            // worse generated code for the comparator function than would be optimal. In
            // fact, when sorting with a comparator, these costs outweigh the benefits of
            // sorting in C++. By using our own JS-implemented Quick Sort (below), we get
            // a ~3500ms mean speed-up in `bench/bench.html`.

            /**
             * Swap the elements indexed by `x` and `y` in the array `ary`.
             *
             * @param {Array} ary
             *        The array.
             * @param {Number} x
             *        The index of the first item.
             * @param {Number} y
             *        The index of the second item.
             */
            function swap(ary, x, y) {
                var temp = ary[x];
                ary[x] = ary[y];
                ary[y] = temp;
            }

            /**
             * Returns a random integer within the range `low .. high` inclusive.
             *
             * @param {Number} low
             *        The lower bound on the range.
             * @param {Number} high
             *        The upper bound on the range.
             */
            function randomIntInRange(low, high) {
                return Math.round(low + (Math.random() * (high - low)));
            }

            /**
             * The Quick Sort algorithm.
             *
             * @param {Array} ary
             *        An array to sort.
             * @param {function} comparator
             *        Function to use to compare two items.
             * @param {Number} p
             *        Start index of the array
             * @param {Number} r
             *        End index of the array
             */
            function doQuickSort(ary, comparator, p, r) {
                // If our lower bound is less than our upper bound, we (1) partition the
                // array into two pieces and (2) recurse on each half. If it is not, this is
                // the empty array and our base case.

                if (p < r) {
                    // (1) Partitioning.
                    //
                    // The partitioning chooses a pivot between `p` and `r` and moves all
                    // elements that are less than or equal to the pivot to the before it, and
                    // all the elements that are greater than it after it. The effect is that
                    // once partition is done, the pivot is in the exact place it will be when
                    // the array is put in sorted order, and it will not need to be moved
                    // again. This runs in O(n) time.

                    // Always choose a random pivot so that an input array which is reverse
                    // sorted does not cause O(n^2) running time.
                    var pivotIndex = randomIntInRange(p, r);
                    var i = p - 1;

                    swap(ary, pivotIndex, r);
                    var pivot = ary[r];

                    // Immediately after `j` is incremented in this loop, the following hold
                    // true:
                    //
                    //   * Every element in `ary[p .. i]` is less than or equal to the pivot.
                    //
                    //   * Every element in `ary[i+1 .. j-1]` is greater than the pivot.
                    for (var j = p; j < r; j++) {
                        if (comparator(ary[j], pivot) <= 0) {
                            i += 1;
                            swap(ary, i, j);
                        }
                    }

                    swap(ary, i + 1, j);
                    var q = i + 1;

                    // (2) Recurse on each half.

                    doQuickSort(ary, comparator, p, q - 1);
                    doQuickSort(ary, comparator, q + 1, r);
                }
            }

            /**
             * Sort the given array in-place with the given comparator function.
             *
             * @param {Array} ary
             *        An array to sort.
             * @param {function} comparator
             *        Function to use to compare two items.
             */
            exports.quickSort = function (ary, comparator) {
                doQuickSort(ary, comparator, 0, ary.length - 1);
            };
        }

    }, {}], 16: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var util = require('./util');
            var binarySearch = require('./binary-search');
            var ArraySet = require('./array-set').ArraySet;
            var base64VLQ = require('./base64-vlq');
            var quickSort = require('./quick-sort').quickSort;

            function SourceMapConsumer(aSourceMap) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === 'string') {
                    sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
                }

                return sourceMap.sections != null
                    ? new IndexedSourceMapConsumer(sourceMap)
                    : new BasicSourceMapConsumer(sourceMap);
            }

            SourceMapConsumer.fromSourceMap = function (aSourceMap) {
                return BasicSourceMapConsumer.fromSourceMap(aSourceMap);
            }

            /**
             * The version of the source mapping spec that we are consuming.
             */
            SourceMapConsumer.prototype._version = 3;

            // `__generatedMappings` and `__originalMappings` are arrays that hold the
            // parsed mapping coordinates from the source map's "mappings" attribute. They
            // are lazily instantiated, accessed via the `_generatedMappings` and
            // `_originalMappings` getters respectively, and we only parse the mappings
            // and create these arrays once queried for a source location. We jump through
            // these hoops because there can be many thousands of mappings, and parsing
            // them is expensive, so we only want to do it if we must.
            //
            // Each object in the arrays is of the form:
            //
            //     {
            //       generatedLine: The line number in the generated code,
            //       generatedColumn: The column number in the generated code,
            //       source: The path to the original source file that generated this
            //               chunk of code,
            //       originalLine: The line number in the original source that
            //                     corresponds to this chunk of generated code,
            //       originalColumn: The column number in the original source that
            //                       corresponds to this chunk of generated code,
            //       name: The name of the original symbol which generated this chunk of
            //             code.
            //     }
            //
            // All properties except for `generatedLine` and `generatedColumn` can be
            // `null`.
            //
            // `_generatedMappings` is ordered by the generated positions.
            //
            // `_originalMappings` is ordered by the original positions.

            SourceMapConsumer.prototype.__generatedMappings = null;
            Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
                get: function () {
                    if (!this.__generatedMappings) {
                        this._parseMappings(this._mappings, this.sourceRoot);
                    }

                    return this.__generatedMappings;
                }
            });

            SourceMapConsumer.prototype.__originalMappings = null;
            Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
                get: function () {
                    if (!this.__originalMappings) {
                        this._parseMappings(this._mappings, this.sourceRoot);
                    }

                    return this.__originalMappings;
                }
            });

            SourceMapConsumer.prototype._charIsMappingSeparator =
                function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
                    var c = aStr.charAt(index);
                    return c === ";" || c === ",";
                };

            /**
             * Parse the mappings in a string in to a data structure which we can easily
             * query (the ordered arrays in the `this.__generatedMappings` and
             * `this.__originalMappings` properties).
             */
            SourceMapConsumer.prototype._parseMappings =
                function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                    throw new Error("Subclasses must implement _parseMappings");
                };

            SourceMapConsumer.GENERATED_ORDER = 1;
            SourceMapConsumer.ORIGINAL_ORDER = 2;

            SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
            SourceMapConsumer.LEAST_UPPER_BOUND = 2;

            /**
             * Iterate over each mapping between an original source/line/column and a
             * generated line/column in this source map.
             *
             * @param Function aCallback
             *        The function that is called with each mapping.
             * @param Object aContext
             *        Optional. If specified, this object will be the value of `this` every
             *        time that `aCallback` is called.
             * @param aOrder
             *        Either `SourceMapConsumer.GENERATED_ORDER` or
             *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
             *        iterate over the mappings sorted by the generated file's line/column
             *        order or the original's source/line/column order, respectively. Defaults to
             *        `SourceMapConsumer.GENERATED_ORDER`.
             */
            SourceMapConsumer.prototype.eachMapping =
                function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
                    var context = aContext || null;
                    var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

                    var mappings;
                    switch (order) {
                        case SourceMapConsumer.GENERATED_ORDER:
                            mappings = this._generatedMappings;
                            break;
                        case SourceMapConsumer.ORIGINAL_ORDER:
                            mappings = this._originalMappings;
                            break;
                        default:
                            throw new Error("Unknown order of iteration.");
                    }

                    var sourceRoot = this.sourceRoot;
                    mappings.map(function (mapping) {
                        var source = mapping.source === null ? null : this._sources.at(mapping.source);
                        if (source != null && sourceRoot != null) {
                            source = util.join(sourceRoot, source);
                        }
                        return {
                            source: source,
                            generatedLine: mapping.generatedLine,
                            generatedColumn: mapping.generatedColumn,
                            originalLine: mapping.originalLine,
                            originalColumn: mapping.originalColumn,
                            name: mapping.name === null ? null : this._names.at(mapping.name)
                        };
                    }, this).forEach(aCallback, context);
                };

            /**
             * Returns all generated line and column information for the original source,
             * line, and column provided. If no column is provided, returns all mappings
             * corresponding to a either the line we are searching for or the next
             * closest line that has any mappings. Otherwise, returns all mappings
             * corresponding to the given line and either the column we are searching for
             * or the next closest column that has any offsets.
             *
             * The only argument is an object with the following properties:
             *
             *   - source: The filename of the original source.
             *   - line: The line number in the original source.
             *   - column: Optional. the column number in the original source.
             *
             * and an array of objects is returned, each with the following properties:
             *
             *   - line: The line number in the generated source, or null.
             *   - column: The column number in the generated source, or null.
             */
            SourceMapConsumer.prototype.allGeneratedPositionsFor =
                function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
                    var line = util.getArg(aArgs, 'line');

                    // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
                    // returns the index of the closest mapping less than the needle. By
                    // setting needle.originalColumn to 0, we thus find the last mapping for
                    // the given line, provided such a mapping exists.
                    var needle = {
                        source: util.getArg(aArgs, 'source'),
                        originalLine: line,
                        originalColumn: util.getArg(aArgs, 'column', 0)
                    };

                    if (this.sourceRoot != null) {
                        needle.source = util.relative(this.sourceRoot, needle.source);
                    }
                    if (!this._sources.has(needle.source)) {
                        return [];
                    }
                    needle.source = this._sources.indexOf(needle.source);

                    var mappings = [];

                    var index = this._findMapping(needle,
                        this._originalMappings,
                        "originalLine",
                        "originalColumn",
                        util.compareByOriginalPositions,
                        binarySearch.LEAST_UPPER_BOUND);
                    if (index >= 0) {
                        var mapping = this._originalMappings[index];

                        if (aArgs.column === undefined) {
                            var originalLine = mapping.originalLine;

                            // Iterate until either we run out of mappings, or we run into
                            // a mapping for a different line than the one we found. Since
                            // mappings are sorted, this is guaranteed to find all mappings for
                            // the line we found.
                            while (mapping && mapping.originalLine === originalLine) {
                                mappings.push({
                                    line: util.getArg(mapping, 'generatedLine', null),
                                    column: util.getArg(mapping, 'generatedColumn', null),
                                    lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
                                });

                                mapping = this._originalMappings[++index];
                            }
                        } else {
                            var originalColumn = mapping.originalColumn;

                            // Iterate until either we run out of mappings, or we run into
                            // a mapping for a different line than the one we were searching for.
                            // Since mappings are sorted, this is guaranteed to find all mappings for
                            // the line we are searching for.
                            while (mapping &&
                            mapping.originalLine === line &&
                            mapping.originalColumn == originalColumn) {
                                mappings.push({
                                    line: util.getArg(mapping, 'generatedLine', null),
                                    column: util.getArg(mapping, 'generatedColumn', null),
                                    lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
                                });

                                mapping = this._originalMappings[++index];
                            }
                        }
                    }

                    return mappings;
                };

            exports.SourceMapConsumer = SourceMapConsumer;

            /**
             * A BasicSourceMapConsumer instance represents a parsed source map which we can
             * query for information about the original file positions by giving it a file
             * position in the generated source.
             *
             * The only parameter is the raw source map (either as a JSON string, or
             * already parsed to an object). According to the spec, source maps have the
             * following attributes:
             *
             *   - version: Which version of the source map spec this map is following.
             *   - sources: An array of URLs to the original source files.
             *   - names: An array of identifiers which can be referrenced by individual mappings.
             *   - sourceRoot: Optional. The URL root from which all sources are relative.
             *   - sourcesContent: Optional. An array of contents of the original source files.
             *   - mappings: A string of base64 VLQs which contain the actual mappings.
             *   - file: Optional. The generated file this source map is associated with.
             *
             * Here is an example source map, taken from the source map spec[0]:
             *
             *     {
             *       version : 3,
             *       file: "out.js",
             *       sourceRoot : "",
             *       sources: ["foo.js", "bar.js"],
             *       names: ["src", "maps", "are", "fun"],
             *       mappings: "AA,AB;;ABCDE;"
             *     }
             *
             * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
             */
            function BasicSourceMapConsumer(aSourceMap) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === 'string') {
                    sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
                }

                var version = util.getArg(sourceMap, 'version');
                var sources = util.getArg(sourceMap, 'sources');
                // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
                // requires the array) to play nice here.
                var names = util.getArg(sourceMap, 'names', []);
                var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
                var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
                var mappings = util.getArg(sourceMap, 'mappings');
                var file = util.getArg(sourceMap, 'file', null);

                // Once again, Sass deviates from the spec and supplies the version as a
                // string rather than a number, so we use loose equality checking here.
                if (version != this._version) {
                    throw new Error('Unsupported version: ' + version);
                }

                sources = sources
                // Some source maps produce relative source paths like "./foo.js" instead of
                // "foo.js".  Normalize these first so that future comparisons will succeed.
                // See bugzil.la/1090768.
                    .map(util.normalize)
                    // Always ensure that absolute sources are internally stored relative to
                    // the source root, if the source root is absolute. Not doing this would
                    // be particularly problematic when the source root is a prefix of the
                    // source (valid, but why??). See github issue #199 and bugzil.la/1188982.
                    .map(function (source) {
                        return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source)
                            ? util.relative(sourceRoot, source)
                            : source;
                    });

                // Pass `true` below to allow duplicate names and sources. While source maps
                // are intended to be compressed and deduplicated, the TypeScript compiler
                // sometimes generates source maps with duplicates in them. See Github issue
                // #72 and bugzil.la/889492.
                this._names = ArraySet.fromArray(names, true);
                this._sources = ArraySet.fromArray(sources, true);

                this.sourceRoot = sourceRoot;
                this.sourcesContent = sourcesContent;
                this._mappings = mappings;
                this.file = file;
            }

            BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
            BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;

            /**
             * Create a BasicSourceMapConsumer from a SourceMapGenerator.
             *
             * @param SourceMapGenerator aSourceMap
             *        The source map that will be consumed.
             * @returns BasicSourceMapConsumer
             */
            BasicSourceMapConsumer.fromSourceMap =
                function SourceMapConsumer_fromSourceMap(aSourceMap) {
                    var smc = Object.create(BasicSourceMapConsumer.prototype);

                    var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
                    var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
                    smc.sourceRoot = aSourceMap._sourceRoot;
                    smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                        smc.sourceRoot);
                    smc.file = aSourceMap._file;

                    // Because we are modifying the entries (by converting string sources and
                    // names to indices into the sources and names ArraySets), we have to make
                    // a copy of the entry or else bad things happen. Shared mutable state
                    // strikes again! See github issue #191.

                    var generatedMappings = aSourceMap._mappings.toArray().slice();
                    var destGeneratedMappings = smc.__generatedMappings = [];
                    var destOriginalMappings = smc.__originalMappings = [];

                    for (var i = 0, length = generatedMappings.length; i < length; i++) {
                        var srcMapping = generatedMappings[i];
                        var destMapping = new Mapping;
                        destMapping.generatedLine = srcMapping.generatedLine;
                        destMapping.generatedColumn = srcMapping.generatedColumn;

                        if (srcMapping.source) {
                            destMapping.source = sources.indexOf(srcMapping.source);
                            destMapping.originalLine = srcMapping.originalLine;
                            destMapping.originalColumn = srcMapping.originalColumn;

                            if (srcMapping.name) {
                                destMapping.name = names.indexOf(srcMapping.name);
                            }

                            destOriginalMappings.push(destMapping);
                        }

                        destGeneratedMappings.push(destMapping);
                    }

                    quickSort(smc.__originalMappings, util.compareByOriginalPositions);

                    return smc;
                };

            /**
             * The version of the source mapping spec that we are consuming.
             */
            BasicSourceMapConsumer.prototype._version = 3;

            /**
             * The list of original sources.
             */
            Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
                get: function () {
                    return this._sources.toArray().map(function (s) {
                        return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
                    }, this);
                }
            });

            /**
             * Provide the JIT with a nice shape / hidden class.
             */
            function Mapping() {
                this.generatedLine = 0;
                this.generatedColumn = 0;
                this.source = null;
                this.originalLine = null;
                this.originalColumn = null;
                this.name = null;
            }

            /**
             * Parse the mappings in a string in to a data structure which we can easily
             * query (the ordered arrays in the `this.__generatedMappings` and
             * `this.__originalMappings` properties).
             */
            BasicSourceMapConsumer.prototype._parseMappings =
                function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                    var generatedLine = 1;
                    var previousGeneratedColumn = 0;
                    var previousOriginalLine = 0;
                    var previousOriginalColumn = 0;
                    var previousSource = 0;
                    var previousName = 0;
                    var length = aStr.length;
                    var index = 0;
                    var cachedSegments = {};
                    var temp = {};
                    var originalMappings = [];
                    var generatedMappings = [];
                    var mapping, str, segment, end, value;

                    while (index < length) {
                        if (aStr.charAt(index) === ';') {
                            generatedLine++;
                            index++;
                            previousGeneratedColumn = 0;
                        } else if (aStr.charAt(index) === ',') {
                            index++;
                        } else {
                            mapping = new Mapping();
                            mapping.generatedLine = generatedLine;

                            // Because each offset is encoded relative to the previous one,
                            // many segments often have the same encoding. We can exploit this
                            // fact by caching the parsed variable length fields of each segment,
                            // allowing us to avoid a second parse if we encounter the same
                            // segment again.
                            for (end = index; end < length; end++) {
                                if (this._charIsMappingSeparator(aStr, end)) {
                                    break;
                                }
                            }
                            str = aStr.slice(index, end);

                            segment = cachedSegments[str];
                            if (segment) {
                                index += str.length;
                            } else {
                                segment = [];
                                while (index < end) {
                                    base64VLQ.decode(aStr, index, temp);
                                    value = temp.value;
                                    index = temp.rest;
                                    segment.push(value);
                                }

                                if (segment.length === 2) {
                                    throw new Error('Found a source, but no line and column');
                                }

                                if (segment.length === 3) {
                                    throw new Error('Found a source and line, but no column');
                                }

                                cachedSegments[str] = segment;
                            }

                            // Generated column.
                            mapping.generatedColumn = previousGeneratedColumn + segment[0];
                            previousGeneratedColumn = mapping.generatedColumn;

                            if (segment.length > 1) {
                                // Original source.
                                mapping.source = previousSource + segment[1];
                                previousSource += segment[1];

                                // Original line.
                                mapping.originalLine = previousOriginalLine + segment[2];
                                previousOriginalLine = mapping.originalLine;
                                // Lines are stored 0-based
                                mapping.originalLine += 1;

                                // Original column.
                                mapping.originalColumn = previousOriginalColumn + segment[3];
                                previousOriginalColumn = mapping.originalColumn;

                                if (segment.length > 4) {
                                    // Original name.
                                    mapping.name = previousName + segment[4];
                                    previousName += segment[4];
                                }
                            }

                            generatedMappings.push(mapping);
                            if (typeof mapping.originalLine === 'number') {
                                originalMappings.push(mapping);
                            }
                        }
                    }

                    quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
                    this.__generatedMappings = generatedMappings;

                    quickSort(originalMappings, util.compareByOriginalPositions);
                    this.__originalMappings = originalMappings;
                };

            /**
             * Find the mapping that best matches the hypothetical "needle" mapping that
             * we are searching for in the given "haystack" of mappings.
             */
            BasicSourceMapConsumer.prototype._findMapping =
                function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                                       aColumnName, aComparator, aBias) {
                    // To return the position we are searching for, we must first find the
                    // mapping for the given position and then return the opposite position it
                    // points to. Because the mappings are sorted, we can use binary search to
                    // find the best mapping.

                    if (aNeedle[aLineName] <= 0) {
                        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
                    }
                    if (aNeedle[aColumnName] < 0) {
                        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
                    }

                    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
                };

            /**
             * Compute the last column for each generated mapping. The last column is
             * inclusive.
             */
            BasicSourceMapConsumer.prototype.computeColumnSpans =
                function SourceMapConsumer_computeColumnSpans() {
                    for (var index = 0; index < this._generatedMappings.length; ++index) {
                        var mapping = this._generatedMappings[index];

                        // Mappings do not contain a field for the last generated columnt. We
                        // can come up with an optimistic estimate, however, by assuming that
                        // mappings are contiguous (i.e. given two consecutive mappings, the
                        // first mapping ends where the second one starts).
                        if (index + 1 < this._generatedMappings.length) {
                            var nextMapping = this._generatedMappings[index + 1];

                            if (mapping.generatedLine === nextMapping.generatedLine) {
                                mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
                                continue;
                            }
                        }

                        // The last mapping for each line spans the entire line.
                        mapping.lastGeneratedColumn = Infinity;
                    }
                };

            /**
             * Returns the original source, line, and column information for the generated
             * source's line and column positions provided. The only argument is an object
             * with the following properties:
             *
             *   - line: The line number in the generated source.
             *   - column: The column number in the generated source.
             *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
             *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
             *     closest element that is smaller than or greater than the one we are
             *     searching for, respectively, if the exact element cannot be found.
             *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
             *
             * and an object is returned with the following properties:
             *
             *   - source: The original source file, or null.
             *   - line: The line number in the original source, or null.
             *   - column: The column number in the original source, or null.
             *   - name: The original identifier, or null.
             */
            BasicSourceMapConsumer.prototype.originalPositionFor =
                function SourceMapConsumer_originalPositionFor(aArgs) {
                    var needle = {
                        generatedLine: util.getArg(aArgs, 'line'),
                        generatedColumn: util.getArg(aArgs, 'column')
                    };

                    var index = this._findMapping(
                        needle,
                        this._generatedMappings,
                        "generatedLine",
                        "generatedColumn",
                        util.compareByGeneratedPositionsDeflated,
                        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
                    );

                    if (index >= 0) {
                        var mapping = this._generatedMappings[index];

                        if (mapping.generatedLine === needle.generatedLine) {
                            var source = util.getArg(mapping, 'source', null);
                            if (source !== null) {
                                source = this._sources.at(source);
                                if (this.sourceRoot != null) {
                                    source = util.join(this.sourceRoot, source);
                                }
                            }
                            var name = util.getArg(mapping, 'name', null);
                            if (name !== null) {
                                name = this._names.at(name);
                            }
                            return {
                                source: source,
                                line: util.getArg(mapping, 'originalLine', null),
                                column: util.getArg(mapping, 'originalColumn', null),
                                name: name
                            };
                        }
                    }

                    return {
                        source: null,
                        line: null,
                        column: null,
                        name: null
                    };
                };

            /**
             * Return true if we have the source content for every source in the source
             * map, false otherwise.
             */
            BasicSourceMapConsumer.prototype.hasContentsOfAllSources =
                function BasicSourceMapConsumer_hasContentsOfAllSources() {
                    if (!this.sourcesContent) {
                        return false;
                    }
                    return this.sourcesContent.length >= this._sources.size() &&
                        !this.sourcesContent.some(function (sc) {
                            return sc == null;
                        });
                };

            /**
             * Returns the original source content. The only argument is the url of the
             * original source file. Returns null if no original source content is
             * available.
             */
            BasicSourceMapConsumer.prototype.sourceContentFor =
                function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
                    if (!this.sourcesContent) {
                        return null;
                    }

                    if (this.sourceRoot != null) {
                        aSource = util.relative(this.sourceRoot, aSource);
                    }

                    if (this._sources.has(aSource)) {
                        return this.sourcesContent[this._sources.indexOf(aSource)];
                    }

                    var url;
                    if (this.sourceRoot != null
                        && (url = util.urlParse(this.sourceRoot))) {
                        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
                        // many users. We can help them out when they expect file:// URIs to
                        // behave like it would if they were running a local HTTP server. See
                        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
                        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
                        if (url.scheme == "file"
                            && this._sources.has(fileUriAbsPath)) {
                            return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
                        }

                        if ((!url.path || url.path == "/")
                            && this._sources.has("/" + aSource)) {
                            return this.sourcesContent[this._sources.indexOf("/" + aSource)];
                        }
                    }

                    // This function is used recursively from
                    // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
                    // don't want to throw if we can't find the source - we just want to
                    // return null, so we provide a flag to exit gracefully.
                    if (nullOnMissing) {
                        return null;
                    } else {
                        throw new Error('"' + aSource + '" is not in the SourceMap.');
                    }
                };

            /**
             * Returns the generated line and column information for the original source,
             * line, and column positions provided. The only argument is an object with
             * the following properties:
             *
             *   - source: The filename of the original source.
             *   - line: The line number in the original source.
             *   - column: The column number in the original source.
             *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
             *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
             *     closest element that is smaller than or greater than the one we are
             *     searching for, respectively, if the exact element cannot be found.
             *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
             *
             * and an object is returned with the following properties:
             *
             *   - line: The line number in the generated source, or null.
             *   - column: The column number in the generated source, or null.
             */
            BasicSourceMapConsumer.prototype.generatedPositionFor =
                function SourceMapConsumer_generatedPositionFor(aArgs) {
                    var source = util.getArg(aArgs, 'source');
                    if (this.sourceRoot != null) {
                        source = util.relative(this.sourceRoot, source);
                    }
                    if (!this._sources.has(source)) {
                        return {
                            line: null,
                            column: null,
                            lastColumn: null
                        };
                    }
                    source = this._sources.indexOf(source);

                    var needle = {
                        source: source,
                        originalLine: util.getArg(aArgs, 'line'),
                        originalColumn: util.getArg(aArgs, 'column')
                    };

                    var index = this._findMapping(
                        needle,
                        this._originalMappings,
                        "originalLine",
                        "originalColumn",
                        util.compareByOriginalPositions,
                        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
                    );

                    if (index >= 0) {
                        var mapping = this._originalMappings[index];

                        if (mapping.source === needle.source) {
                            return {
                                line: util.getArg(mapping, 'generatedLine', null),
                                column: util.getArg(mapping, 'generatedColumn', null),
                                lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
                            };
                        }
                    }

                    return {
                        line: null,
                        column: null,
                        lastColumn: null
                    };
                };

            exports.BasicSourceMapConsumer = BasicSourceMapConsumer;

            /**
             * An IndexedSourceMapConsumer instance represents a parsed source map which
             * we can query for information. It differs from BasicSourceMapConsumer in
             * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
             * input.
             *
             * The only parameter is a raw source map (either as a JSON string, or already
             * parsed to an object). According to the spec for indexed source maps, they
             * have the following attributes:
             *
             *   - version: Which version of the source map spec this map is following.
             *   - file: Optional. The generated file this source map is associated with.
             *   - sections: A list of section definitions.
             *
             * Each value under the "sections" field has two fields:
             *   - offset: The offset into the original specified at which this section
             *       begins to apply, defined as an object with a "line" and "column"
             *       field.
             *   - map: A source map definition. This source map could also be indexed,
             *       but doesn't have to be.
             *
             * Instead of the "map" field, it's also possible to have a "url" field
             * specifying a URL to retrieve a source map from, but that's currently
             * unsupported.
             *
             * Here's an example source map, taken from the source map spec[0], but
             * modified to omit a section which uses the "url" field.
             *
             *  {
             *    version : 3,
             *    file: "app.js",
             *    sections: [{
             *      offset: {line:100, column:10},
             *      map: {
             *        version : 3,
             *        file: "section.js",
             *        sources: ["foo.js", "bar.js"],
             *        names: ["src", "maps", "are", "fun"],
             *        mappings: "AAAA,E;;ABCDE;"
             *      }
             *    }],
             *  }
             *
             * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
             */
            function IndexedSourceMapConsumer(aSourceMap) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === 'string') {
                    sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
                }

                var version = util.getArg(sourceMap, 'version');
                var sections = util.getArg(sourceMap, 'sections');

                if (version != this._version) {
                    throw new Error('Unsupported version: ' + version);
                }

                this._sources = new ArraySet();
                this._names = new ArraySet();

                var lastOffset = {
                    line: -1,
                    column: 0
                };
                this._sections = sections.map(function (s) {
                    if (s.url) {
                        // The url field will require support for asynchronicity.
                        // See https://github.com/mozilla/source-map/issues/16
                        throw new Error('Support for url field in sections not implemented.');
                    }
                    var offset = util.getArg(s, 'offset');
                    var offsetLine = util.getArg(offset, 'line');
                    var offsetColumn = util.getArg(offset, 'column');

                    if (offsetLine < lastOffset.line ||
                        (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
                        throw new Error('Section offsets must be ordered and non-overlapping.');
                    }
                    lastOffset = offset;

                    return {
                        generatedOffset: {
                            // The offset fields are 0-based, but we use 1-based indices when
                            // encoding/decoding from VLQ.
                            generatedLine: offsetLine + 1,
                            generatedColumn: offsetColumn + 1
                        },
                        consumer: new SourceMapConsumer(util.getArg(s, 'map'))
                    }
                });
            }

            IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
            IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;

            /**
             * The version of the source mapping spec that we are consuming.
             */
            IndexedSourceMapConsumer.prototype._version = 3;

            /**
             * The list of original sources.
             */
            Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
                get: function () {
                    var sources = [];
                    for (var i = 0; i < this._sections.length; i++) {
                        for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
                            sources.push(this._sections[i].consumer.sources[j]);
                        }
                    }
                    return sources;
                }
            });

            /**
             * Returns the original source, line, and column information for the generated
             * source's line and column positions provided. The only argument is an object
             * with the following properties:
             *
             *   - line: The line number in the generated source.
             *   - column: The column number in the generated source.
             *
             * and an object is returned with the following properties:
             *
             *   - source: The original source file, or null.
             *   - line: The line number in the original source, or null.
             *   - column: The column number in the original source, or null.
             *   - name: The original identifier, or null.
             */
            IndexedSourceMapConsumer.prototype.originalPositionFor =
                function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
                    var needle = {
                        generatedLine: util.getArg(aArgs, 'line'),
                        generatedColumn: util.getArg(aArgs, 'column')
                    };

                    // Find the section containing the generated position we're trying to map
                    // to an original position.
                    var sectionIndex = binarySearch.search(needle, this._sections,
                        function (needle, section) {
                            var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
                            if (cmp) {
                                return cmp;
                            }

                            return (needle.generatedColumn -
                                section.generatedOffset.generatedColumn);
                        });
                    var section = this._sections[sectionIndex];

                    if (!section) {
                        return {
                            source: null,
                            line: null,
                            column: null,
                            name: null
                        };
                    }

                    return section.consumer.originalPositionFor({
                        line: needle.generatedLine -
                            (section.generatedOffset.generatedLine - 1),
                        column: needle.generatedColumn -
                            (section.generatedOffset.generatedLine === needle.generatedLine
                                ? section.generatedOffset.generatedColumn - 1
                                : 0),
                        bias: aArgs.bias
                    });
                };

            /**
             * Return true if we have the source content for every source in the source
             * map, false otherwise.
             */
            IndexedSourceMapConsumer.prototype.hasContentsOfAllSources =
                function IndexedSourceMapConsumer_hasContentsOfAllSources() {
                    return this._sections.every(function (s) {
                        return s.consumer.hasContentsOfAllSources();
                    });
                };

            /**
             * Returns the original source content. The only argument is the url of the
             * original source file. Returns null if no original source content is
             * available.
             */
            IndexedSourceMapConsumer.prototype.sourceContentFor =
                function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
                    for (var i = 0; i < this._sections.length; i++) {
                        var section = this._sections[i];

                        var content = section.consumer.sourceContentFor(aSource, true);
                        if (content) {
                            return content;
                        }
                    }
                    if (nullOnMissing) {
                        return null;
                    } else {
                        throw new Error('"' + aSource + '" is not in the SourceMap.');
                    }
                };

            /**
             * Returns the generated line and column information for the original source,
             * line, and column positions provided. The only argument is an object with
             * the following properties:
             *
             *   - source: The filename of the original source.
             *   - line: The line number in the original source.
             *   - column: The column number in the original source.
             *
             * and an object is returned with the following properties:
             *
             *   - line: The line number in the generated source, or null.
             *   - column: The column number in the generated source, or null.
             */
            IndexedSourceMapConsumer.prototype.generatedPositionFor =
                function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
                    for (var i = 0; i < this._sections.length; i++) {
                        var section = this._sections[i];

                        // Only consider this section if the requested source is in the list of
                        // sources of the consumer.
                        if (section.consumer.sources.indexOf(util.getArg(aArgs, 'source')) === -1) {
                            continue;
                        }
                        var generatedPosition = section.consumer.generatedPositionFor(aArgs);
                        if (generatedPosition) {
                            var ret = {
                                line: generatedPosition.line +
                                    (section.generatedOffset.generatedLine - 1),
                                column: generatedPosition.column +
                                    (section.generatedOffset.generatedLine === generatedPosition.line
                                        ? section.generatedOffset.generatedColumn - 1
                                        : 0)
                            };
                            return ret;
                        }
                    }

                    return {
                        line: null,
                        column: null
                    };
                };

            /**
             * Parse the mappings in a string in to a data structure which we can easily
             * query (the ordered arrays in the `this.__generatedMappings` and
             * `this.__originalMappings` properties).
             */
            IndexedSourceMapConsumer.prototype._parseMappings =
                function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                    this.__generatedMappings = [];
                    this.__originalMappings = [];
                    for (var i = 0; i < this._sections.length; i++) {
                        var section = this._sections[i];
                        var sectionMappings = section.consumer._generatedMappings;
                        for (var j = 0; j < sectionMappings.length; j++) {
                            var mapping = sectionMappings[j];

                            var source = section.consumer._sources.at(mapping.source);
                            if (section.consumer.sourceRoot !== null) {
                                source = util.join(section.consumer.sourceRoot, source);
                            }
                            this._sources.add(source);
                            source = this._sources.indexOf(source);

                            var name = section.consumer._names.at(mapping.name);
                            this._names.add(name);
                            name = this._names.indexOf(name);

                            // The mappings coming from the consumer for the section have
                            // generated positions relative to the start of the section, so we
                            // need to offset them to be relative to the start of the concatenated
                            // generated file.
                            var adjustedMapping = {
                                source: source,
                                generatedLine: mapping.generatedLine +
                                    (section.generatedOffset.generatedLine - 1),
                                generatedColumn: mapping.generatedColumn +
                                    (section.generatedOffset.generatedLine === mapping.generatedLine
                                        ? section.generatedOffset.generatedColumn - 1
                                        : 0),
                                originalLine: mapping.originalLine,
                                originalColumn: mapping.originalColumn,
                                name: name
                            };

                            this.__generatedMappings.push(adjustedMapping);
                            if (typeof adjustedMapping.originalLine === 'number') {
                                this.__originalMappings.push(adjustedMapping);
                            }
                        }
                    }

                    quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
                    quickSort(this.__originalMappings, util.compareByOriginalPositions);
                };

            exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
        }

    }, {"./array-set": 10, "./base64-vlq": 11, "./binary-search": 13, "./quick-sort": 15, "./util": 19}], 17: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var base64VLQ = require('./base64-vlq');
            var util = require('./util');
            var ArraySet = require('./array-set').ArraySet;
            var MappingList = require('./mapping-list').MappingList;

            /**
             * An instance of the SourceMapGenerator represents a source map which is
             * being built incrementally. You may pass an object with the following
             * properties:
             *
             *   - file: The filename of the generated source.
             *   - sourceRoot: A root for all relative URLs in this source map.
             */
            function SourceMapGenerator(aArgs) {
                if (!aArgs) {
                    aArgs = {};
                }
                this._file = util.getArg(aArgs, 'file', null);
                this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
                this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
                this._sources = new ArraySet();
                this._names = new ArraySet();
                this._mappings = new MappingList();
                this._sourcesContents = null;
            }

            SourceMapGenerator.prototype._version = 3;

            /**
             * Creates a new SourceMapGenerator based on a SourceMapConsumer
             *
             * @param aSourceMapConsumer The SourceMap.
             */
            SourceMapGenerator.fromSourceMap =
                function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
                    var sourceRoot = aSourceMapConsumer.sourceRoot;
                    var generator = new SourceMapGenerator({
                        file: aSourceMapConsumer.file,
                        sourceRoot: sourceRoot
                    });
                    aSourceMapConsumer.eachMapping(function (mapping) {
                        var newMapping = {
                            generated: {
                                line: mapping.generatedLine,
                                column: mapping.generatedColumn
                            }
                        };

                        if (mapping.source != null) {
                            newMapping.source = mapping.source;
                            if (sourceRoot != null) {
                                newMapping.source = util.relative(sourceRoot, newMapping.source);
                            }

                            newMapping.original = {
                                line: mapping.originalLine,
                                column: mapping.originalColumn
                            };

                            if (mapping.name != null) {
                                newMapping.name = mapping.name;
                            }
                        }

                        generator.addMapping(newMapping);
                    });
                    aSourceMapConsumer.sources.forEach(function (sourceFile) {
                        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                        if (content != null) {
                            generator.setSourceContent(sourceFile, content);
                        }
                    });
                    return generator;
                };

            /**
             * Add a single mapping from original source line and column to the generated
             * source's line and column for this source map being created. The mapping
             * object should have the following properties:
             *
             *   - generated: An object with the generated line and column positions.
             *   - original: An object with the original line and column positions.
             *   - source: The original source file (relative to the sourceRoot).
             *   - name: An optional original token name for this mapping.
             */
            SourceMapGenerator.prototype.addMapping =
                function SourceMapGenerator_addMapping(aArgs) {
                    var generated = util.getArg(aArgs, 'generated');
                    var original = util.getArg(aArgs, 'original', null);
                    var source = util.getArg(aArgs, 'source', null);
                    var name = util.getArg(aArgs, 'name', null);

                    if (!this._skipValidation) {
                        this._validateMapping(generated, original, source, name);
                    }

                    if (source != null && !this._sources.has(source)) {
                        this._sources.add(source);
                    }

                    if (name != null && !this._names.has(name)) {
                        this._names.add(name);
                    }

                    this._mappings.add({
                        generatedLine: generated.line,
                        generatedColumn: generated.column,
                        originalLine: original != null && original.line,
                        originalColumn: original != null && original.column,
                        source: source,
                        name: name
                    });
                };

            /**
             * Set the source content for a source file.
             */
            SourceMapGenerator.prototype.setSourceContent =
                function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
                    var source = aSourceFile;
                    if (this._sourceRoot != null) {
                        source = util.relative(this._sourceRoot, source);
                    }

                    if (aSourceContent != null) {
                        // Add the source content to the _sourcesContents map.
                        // Create a new _sourcesContents map if the property is null.
                        if (!this._sourcesContents) {
                            this._sourcesContents = {};
                        }
                        this._sourcesContents[util.toSetString(source)] = aSourceContent;
                    } else if (this._sourcesContents) {
                        // Remove the source file from the _sourcesContents map.
                        // If the _sourcesContents map is empty, set the property to null.
                        delete this._sourcesContents[util.toSetString(source)];
                        if (Object.keys(this._sourcesContents).length === 0) {
                            this._sourcesContents = null;
                        }
                    }
                };

            /**
             * Applies the mappings of a sub-source-map for a specific source file to the
             * source map being generated. Each mapping to the supplied source file is
             * rewritten using the supplied source map. Note: The resolution for the
             * resulting mappings is the minimium of this map and the supplied map.
             *
             * @param aSourceMapConsumer The source map to be applied.
             * @param aSourceFile Optional. The filename of the source file.
             *        If omitted, SourceMapConsumer's file property will be used.
             * @param aSourceMapPath Optional. The dirname of the path to the source map
             *        to be applied. If relative, it is relative to the SourceMapConsumer.
             *        This parameter is needed when the two source maps aren't in the same
             *        directory, and the source map to be applied contains relative source
             *        paths. If so, those relative source paths need to be rewritten
             *        relative to the SourceMapGenerator.
             */
            SourceMapGenerator.prototype.applySourceMap =
                function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
                    var sourceFile = aSourceFile;
                    // If aSourceFile is omitted, we will use the file property of the SourceMap
                    if (aSourceFile == null) {
                        if (aSourceMapConsumer.file == null) {
                            throw new Error(
                                'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
                                'or the source map\'s "file" property. Both were omitted.'
                            );
                        }
                        sourceFile = aSourceMapConsumer.file;
                    }
                    var sourceRoot = this._sourceRoot;
                    // Make "sourceFile" relative if an absolute Url is passed.
                    if (sourceRoot != null) {
                        sourceFile = util.relative(sourceRoot, sourceFile);
                    }
                    // Applying the SourceMap can add and remove items from the sources and
                    // the names array.
                    var newSources = new ArraySet();
                    var newNames = new ArraySet();

                    // Find mappings for the "sourceFile"
                    this._mappings.unsortedForEach(function (mapping) {
                        if (mapping.source === sourceFile && mapping.originalLine != null) {
                            // Check if it can be mapped by the source map, then update the mapping.
                            var original = aSourceMapConsumer.originalPositionFor({
                                line: mapping.originalLine,
                                column: mapping.originalColumn
                            });
                            if (original.source != null) {
                                // Copy mapping
                                mapping.source = original.source;
                                if (aSourceMapPath != null) {
                                    mapping.source = util.join(aSourceMapPath, mapping.source)
                                }
                                if (sourceRoot != null) {
                                    mapping.source = util.relative(sourceRoot, mapping.source);
                                }
                                mapping.originalLine = original.line;
                                mapping.originalColumn = original.column;
                                if (original.name != null) {
                                    mapping.name = original.name;
                                }
                            }
                        }

                        var source = mapping.source;
                        if (source != null && !newSources.has(source)) {
                            newSources.add(source);
                        }

                        var name = mapping.name;
                        if (name != null && !newNames.has(name)) {
                            newNames.add(name);
                        }

                    }, this);
                    this._sources = newSources;
                    this._names = newNames;

                    // Copy sourcesContents of applied map.
                    aSourceMapConsumer.sources.forEach(function (sourceFile) {
                        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                        if (content != null) {
                            if (aSourceMapPath != null) {
                                sourceFile = util.join(aSourceMapPath, sourceFile);
                            }
                            if (sourceRoot != null) {
                                sourceFile = util.relative(sourceRoot, sourceFile);
                            }
                            this.setSourceContent(sourceFile, content);
                        }
                    }, this);
                };

            /**
             * A mapping can have one of the three levels of data:
             *
             *   1. Just the generated position.
             *   2. The Generated position, original position, and original source.
             *   3. Generated and original position, original source, as well as a name
             *      token.
             *
             * To maintain consistency, we validate that any new mapping being added falls
             * in to one of these categories.
             */
            SourceMapGenerator.prototype._validateMapping =
                function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                            aName) {
                    if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
                        && aGenerated.line > 0 && aGenerated.column >= 0
                        && !aOriginal && !aSource && !aName) {
                        // Case 1.
                        return;
                    } else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
                        && aOriginal && 'line' in aOriginal && 'column' in aOriginal
                        && aGenerated.line > 0 && aGenerated.column >= 0
                        && aOriginal.line > 0 && aOriginal.column >= 0
                        && aSource) {
                        // Cases 2 and 3.
                        return;
                    } else {
                        throw new Error('Invalid mapping: ' + JSON.stringify({
                            generated: aGenerated,
                            source: aSource,
                            original: aOriginal,
                            name: aName
                        }));
                    }
                };

            /**
             * Serialize the accumulated mappings in to the stream of base 64 VLQs
             * specified by the source map format.
             */
            SourceMapGenerator.prototype._serializeMappings =
                function SourceMapGenerator_serializeMappings() {
                    var previousGeneratedColumn = 0;
                    var previousGeneratedLine = 1;
                    var previousOriginalColumn = 0;
                    var previousOriginalLine = 0;
                    var previousName = 0;
                    var previousSource = 0;
                    var result = '';
                    var mapping;
                    var nameIdx;
                    var sourceIdx;

                    var mappings = this._mappings.toArray();
                    for (var i = 0, len = mappings.length; i < len; i++) {
                        mapping = mappings[i];

                        if (mapping.generatedLine !== previousGeneratedLine) {
                            previousGeneratedColumn = 0;
                            while (mapping.generatedLine !== previousGeneratedLine) {
                                result += ';';
                                previousGeneratedLine++;
                            }
                        } else {
                            if (i > 0) {
                                if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
                                    continue;
                                }
                                result += ',';
                            }
                        }

                        result += base64VLQ.encode(mapping.generatedColumn
                            - previousGeneratedColumn);
                        previousGeneratedColumn = mapping.generatedColumn;

                        if (mapping.source != null) {
                            sourceIdx = this._sources.indexOf(mapping.source);
                            result += base64VLQ.encode(sourceIdx - previousSource);
                            previousSource = sourceIdx;

                            // lines are stored 0-based in SourceMap spec version 3
                            result += base64VLQ.encode(mapping.originalLine - 1
                                - previousOriginalLine);
                            previousOriginalLine = mapping.originalLine - 1;

                            result += base64VLQ.encode(mapping.originalColumn
                                - previousOriginalColumn);
                            previousOriginalColumn = mapping.originalColumn;

                            if (mapping.name != null) {
                                nameIdx = this._names.indexOf(mapping.name);
                                result += base64VLQ.encode(nameIdx - previousName);
                                previousName = nameIdx;
                            }
                        }
                    }

                    return result;
                };

            SourceMapGenerator.prototype._generateSourcesContent =
                function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
                    return aSources.map(function (source) {
                        if (!this._sourcesContents) {
                            return null;
                        }
                        if (aSourceRoot != null) {
                            source = util.relative(aSourceRoot, source);
                        }
                        var key = util.toSetString(source);
                        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                            key)
                            ? this._sourcesContents[key]
                            : null;
                    }, this);
                };

            /**
             * Externalize the source map.
             */
            SourceMapGenerator.prototype.toJSON =
                function SourceMapGenerator_toJSON() {
                    var map = {
                        version: this._version,
                        sources: this._sources.toArray(),
                        names: this._names.toArray(),
                        mappings: this._serializeMappings()
                    };
                    if (this._file != null) {
                        map.file = this._file;
                    }
                    if (this._sourceRoot != null) {
                        map.sourceRoot = this._sourceRoot;
                    }
                    if (this._sourcesContents) {
                        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
                    }

                    return map;
                };

            /**
             * Render the source map being generated to a string.
             */
            SourceMapGenerator.prototype.toString =
                function SourceMapGenerator_toString() {
                    return JSON.stringify(this.toJSON());
                };

            exports.SourceMapGenerator = SourceMapGenerator;
        }

    }, {"./array-set": 10, "./base64-vlq": 11, "./mapping-list": 14, "./util": 19}], 18: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
            var util = require('./util');

            // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
            // operating systems these days (capturing the result).
            var REGEX_NEWLINE = /(\r?\n)/;

            // Newline character code for charCodeAt() comparisons
            var NEWLINE_CODE = 10;

            // Private symbol for identifying `SourceNode`s when multiple versions of
            // the source-map library are loaded. This MUST NOT CHANGE across
            // versions!
            var isSourceNode = "$$$isSourceNode$$$";

            /**
             * SourceNodes provide a way to abstract over interpolating/concatenating
             * snippets of generated JavaScript source code while maintaining the line and
             * column information associated with the original source code.
             *
             * @param aLine The original line number.
             * @param aColumn The original column number.
             * @param aSource The original source's filename.
             * @param aChunks Optional. An array of strings which are snippets of
             *        generated JS, or other SourceNodes.
             * @param aName The original identifier.
             */
            function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
                this.children = [];
                this.sourceContents = {};
                this.line = aLine == null ? null : aLine;
                this.column = aColumn == null ? null : aColumn;
                this.source = aSource == null ? null : aSource;
                this.name = aName == null ? null : aName;
                this[isSourceNode] = true;
                if (aChunks != null) this.add(aChunks);
            }

            /**
             * Creates a SourceNode from generated code and a SourceMapConsumer.
             *
             * @param aGeneratedCode The generated code
             * @param aSourceMapConsumer The SourceMap for the generated code
             * @param aRelativePath Optional. The path that relative sources in the
             *        SourceMapConsumer should be relative to.
             */
            SourceNode.fromStringWithSourceMap =
                function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
                    // The SourceNode we want to fill with the generated code
                    // and the SourceMap
                    var node = new SourceNode();

                    // All even indices of this array are one line of the generated code,
                    // while all odd indices are the newlines between two adjacent lines
                    // (since `REGEX_NEWLINE` captures its match).
                    // Processed fragments are removed from this array, by calling `shiftNextLine`.
                    var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
                    var shiftNextLine = function () {
                        var lineContents = remainingLines.shift();
                        // The last line of a file might not have a newline.
                        var newLine = remainingLines.shift() || "";
                        return lineContents + newLine;
                    };

                    // We need to remember the position of "remainingLines"
                    var lastGeneratedLine = 1, lastGeneratedColumn = 0;

                    // The generate SourceNodes we need a code range.
                    // To extract it current and last mapping is used.
                    // Here we store the last mapping.
                    var lastMapping = null;

                    aSourceMapConsumer.eachMapping(function (mapping) {
                        if (lastMapping !== null) {
                            // We add the code from "lastMapping" to "mapping":
                            // First check if there is a new line in between.
                            if (lastGeneratedLine < mapping.generatedLine) {
                                // Associate first line with "lastMapping"
                                addMappingWithCode(lastMapping, shiftNextLine());
                                lastGeneratedLine++;
                                lastGeneratedColumn = 0;
                                // The remaining code is added without mapping
                            } else {
                                // There is no new line in between.
                                // Associate the code between "lastGeneratedColumn" and
                                // "mapping.generatedColumn" with "lastMapping"
                                var nextLine = remainingLines[0];
                                var code = nextLine.substr(0, mapping.generatedColumn -
                                    lastGeneratedColumn);
                                remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                    lastGeneratedColumn);
                                lastGeneratedColumn = mapping.generatedColumn;
                                addMappingWithCode(lastMapping, code);
                                // No more remaining code, continue
                                lastMapping = mapping;
                                return;
                            }
                        }
                        // We add the generated code until the first mapping
                        // to the SourceNode without any mapping.
                        // Each line is added as separate string.
                        while (lastGeneratedLine < mapping.generatedLine) {
                            node.add(shiftNextLine());
                            lastGeneratedLine++;
                        }
                        if (lastGeneratedColumn < mapping.generatedColumn) {
                            var nextLine = remainingLines[0];
                            node.add(nextLine.substr(0, mapping.generatedColumn));
                            remainingLines[0] = nextLine.substr(mapping.generatedColumn);
                            lastGeneratedColumn = mapping.generatedColumn;
                        }
                        lastMapping = mapping;
                    }, this);
                    // We have processed all mappings.
                    if (remainingLines.length > 0) {
                        if (lastMapping) {
                            // Associate the remaining code in the current line with "lastMapping"
                            addMappingWithCode(lastMapping, shiftNextLine());
                        }
                        // and add the remaining lines without any mapping
                        node.add(remainingLines.join(""));
                    }

                    // Copy sourcesContent into SourceNode
                    aSourceMapConsumer.sources.forEach(function (sourceFile) {
                        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                        if (content != null) {
                            if (aRelativePath != null) {
                                sourceFile = util.join(aRelativePath, sourceFile);
                            }
                            node.setSourceContent(sourceFile, content);
                        }
                    });

                    return node;

                    function addMappingWithCode(mapping, code) {
                        if (mapping === null || mapping.source === undefined) {
                            node.add(code);
                        } else {
                            var source = aRelativePath
                                ? util.join(aRelativePath, mapping.source)
                                : mapping.source;
                            node.add(new SourceNode(mapping.originalLine,
                                mapping.originalColumn,
                                source,
                                code,
                                mapping.name));
                        }
                    }
                };

            /**
             * Add a chunk of generated JS to this source node.
             *
             * @param aChunk A string snippet of generated JS code, another instance of
             *        SourceNode, or an array where each member is one of those things.
             */
            SourceNode.prototype.add = function SourceNode_add(aChunk) {
                if (Array.isArray(aChunk)) {
                    aChunk.forEach(function (chunk) {
                        this.add(chunk);
                    }, this);
                } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
                    if (aChunk) {
                        this.children.push(aChunk);
                    }
                } else {
                    throw new TypeError(
                        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
                    );
                }
                return this;
            };

            /**
             * Add a chunk of generated JS to the beginning of this source node.
             *
             * @param aChunk A string snippet of generated JS code, another instance of
             *        SourceNode, or an array where each member is one of those things.
             */
            SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
                if (Array.isArray(aChunk)) {
                    for (var i = aChunk.length - 1; i >= 0; i--) {
                        this.prepend(aChunk[i]);
                    }
                } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
                    this.children.unshift(aChunk);
                } else {
                    throw new TypeError(
                        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
                    );
                }
                return this;
            };

            /**
             * Walk over the tree of JS snippets in this node and its children. The
             * walking function is called once for each snippet of JS and is passed that
             * snippet and the its original associated source's line/column location.
             *
             * @param aFn The traversal function.
             */
            SourceNode.prototype.walk = function SourceNode_walk(aFn) {
                var chunk;
                for (var i = 0, len = this.children.length; i < len; i++) {
                    chunk = this.children[i];
                    if (chunk[isSourceNode]) {
                        chunk.walk(aFn);
                    } else {
                        if (chunk !== '') {
                            aFn(chunk, {
                                source: this.source,
                                line: this.line,
                                column: this.column,
                                name: this.name
                            });
                        }
                    }
                }
            };

            /**
             * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
             * each of `this.children`.
             *
             * @param aSep The separator.
             */
            SourceNode.prototype.join = function SourceNode_join(aSep) {
                var newChildren;
                var i;
                var len = this.children.length;
                if (len > 0) {
                    newChildren = [];
                    for (i = 0; i < len - 1; i++) {
                        newChildren.push(this.children[i]);
                        newChildren.push(aSep);
                    }
                    newChildren.push(this.children[i]);
                    this.children = newChildren;
                }
                return this;
            };

            /**
             * Call String.prototype.replace on the very right-most source snippet. Useful
             * for trimming whitespace from the end of a source node, etc.
             *
             * @param aPattern The pattern to replace.
             * @param aReplacement The thing to replace the pattern with.
             */
            SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
                var lastChild = this.children[this.children.length - 1];
                if (lastChild[isSourceNode]) {
                    lastChild.replaceRight(aPattern, aReplacement);
                } else if (typeof lastChild === 'string') {
                    this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
                } else {
                    this.children.push(''.replace(aPattern, aReplacement));
                }
                return this;
            };

            /**
             * Set the source content for a source file. This will be added to the SourceMapGenerator
             * in the sourcesContent field.
             *
             * @param aSourceFile The filename of the source file
             * @param aSourceContent The content of the source file
             */
            SourceNode.prototype.setSourceContent =
                function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
                    this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
                };

            /**
             * Walk over the tree of SourceNodes. The walking function is called for each
             * source file content and is passed the filename and source content.
             *
             * @param aFn The traversal function.
             */
            SourceNode.prototype.walkSourceContents =
                function SourceNode_walkSourceContents(aFn) {
                    for (var i = 0, len = this.children.length; i < len; i++) {
                        if (this.children[i][isSourceNode]) {
                            this.children[i].walkSourceContents(aFn);
                        }
                    }

                    var sources = Object.keys(this.sourceContents);
                    for (var i = 0, len = sources.length; i < len; i++) {
                        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
                    }
                };

            /**
             * Return the string representation of this source node. Walks over the tree
             * and concatenates all the various snippets together to one string.
             */
            SourceNode.prototype.toString = function SourceNode_toString() {
                var str = "";
                this.walk(function (chunk) {
                    str += chunk;
                });
                return str;
            };

            /**
             * Returns the string representation of this source node along with a source
             * map.
             */
            SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
                var generated = {
                    code: "",
                    line: 1,
                    column: 0
                };
                var map = new SourceMapGenerator(aArgs);
                var sourceMappingActive = false;
                var lastOriginalSource = null;
                var lastOriginalLine = null;
                var lastOriginalColumn = null;
                var lastOriginalName = null;
                this.walk(function (chunk, original) {
                    generated.code += chunk;
                    if (original.source !== null
                        && original.line !== null
                        && original.column !== null) {
                        if (lastOriginalSource !== original.source
                            || lastOriginalLine !== original.line
                            || lastOriginalColumn !== original.column
                            || lastOriginalName !== original.name) {
                            map.addMapping({
                                source: original.source,
                                original: {
                                    line: original.line,
                                    column: original.column
                                },
                                generated: {
                                    line: generated.line,
                                    column: generated.column
                                },
                                name: original.name
                            });
                        }
                        lastOriginalSource = original.source;
                        lastOriginalLine = original.line;
                        lastOriginalColumn = original.column;
                        lastOriginalName = original.name;
                        sourceMappingActive = true;
                    } else if (sourceMappingActive) {
                        map.addMapping({
                            generated: {
                                line: generated.line,
                                column: generated.column
                            }
                        });
                        lastOriginalSource = null;
                        sourceMappingActive = false;
                    }
                    for (var idx = 0, length = chunk.length; idx < length; idx++) {
                        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
                            generated.line++;
                            generated.column = 0;
                            // Mappings end at eol
                            if (idx + 1 === length) {
                                lastOriginalSource = null;
                                sourceMappingActive = false;
                            } else if (sourceMappingActive) {
                                map.addMapping({
                                    source: original.source,
                                    original: {
                                        line: original.line,
                                        column: original.column
                                    },
                                    generated: {
                                        line: generated.line,
                                        column: generated.column
                                    },
                                    name: original.name
                                });
                            }
                        } else {
                            generated.column++;
                        }
                    }
                });
                this.walkSourceContents(function (sourceFile, sourceContent) {
                    map.setSourceContent(sourceFile, sourceContent);
                });

                return {code: generated.code, map: map};
            };

            exports.SourceNode = SourceNode;
        }

    }, {"./source-map-generator": 17, "./util": 19}], 19: [function (require, module, exports) {
        /* -*- Mode: js; js-indent-level: 2; -*- */
        /*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        {
            /**
             * This is a helper function for getting values from parameter/options
             * objects.
             *
             * @param args The object we are extracting values from
             * @param name The name of the property we are getting.
             * @param defaultValue An optional value to return if the property is missing
             * from the object. If this is not specified and the property is missing, an
             * error will be thrown.
             */
            function getArg(aArgs, aName, aDefaultValue) {
                if (aName in aArgs) {
                    return aArgs[aName];
                } else if (arguments.length === 3) {
                    return aDefaultValue;
                } else {
                    throw new Error('"' + aName + '" is a required argument.');
                }
            }

            exports.getArg = getArg;

            var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
            var dataUrlRegexp = /^data:.+\,.+$/;

            function urlParse(aUrl) {
                var match = aUrl.match(urlRegexp);
                if (!match) {
                    return null;
                }
                return {
                    scheme: match[1],
                    auth: match[2],
                    host: match[3],
                    port: match[4],
                    path: match[5]
                };
            }

            exports.urlParse = urlParse;

            function urlGenerate(aParsedUrl) {
                var url = '';
                if (aParsedUrl.scheme) {
                    url += aParsedUrl.scheme + ':';
                }
                url += '//';
                if (aParsedUrl.auth) {
                    url += aParsedUrl.auth + '@';
                }
                if (aParsedUrl.host) {
                    url += aParsedUrl.host;
                }
                if (aParsedUrl.port) {
                    url += ":" + aParsedUrl.port
                }
                if (aParsedUrl.path) {
                    url += aParsedUrl.path;
                }
                return url;
            }

            exports.urlGenerate = urlGenerate;

            /**
             * Normalizes a path, or the path portion of a URL:
             *
             * - Replaces consequtive slashes with one slash.
             * - Removes unnecessary '.' parts.
             * - Removes unnecessary '<dir>/..' parts.
             *
             * Based on code in the Node.js 'path' core module.
             *
             * @param aPath The path or url to normalize.
             */
            function normalize(aPath) {
                var path = aPath;
                var url = urlParse(aPath);
                if (url) {
                    if (!url.path) {
                        return aPath;
                    }
                    path = url.path;
                }
                var isAbsolute = exports.isAbsolute(path);

                var parts = path.split(/\/+/);
                for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
                    part = parts[i];
                    if (part === '.') {
                        parts.splice(i, 1);
                    } else if (part === '..') {
                        up++;
                    } else if (up > 0) {
                        if (part === '') {
                            // The first part is blank if the path is absolute. Trying to go
                            // above the root is a no-op. Therefore we can remove all '..' parts
                            // directly after the root.
                            parts.splice(i + 1, up);
                            up = 0;
                        } else {
                            parts.splice(i, 2);
                            up--;
                        }
                    }
                }
                path = parts.join('/');

                if (path === '') {
                    path = isAbsolute ? '/' : '.';
                }

                if (url) {
                    url.path = path;
                    return urlGenerate(url);
                }
                return path;
            }

            exports.normalize = normalize;

            /**
             * Joins two paths/URLs.
             *
             * @param aRoot The root path or URL.
             * @param aPath The path or URL to be joined with the root.
             *
             * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
             *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
             *   first.
             * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
             *   is updated with the result and aRoot is returned. Otherwise the result
             *   is returned.
             *   - If aPath is absolute, the result is aPath.
             *   - Otherwise the two paths are joined with a slash.
             * - Joining for example 'http://' and 'www.example.com' is also supported.
             */
            function join(aRoot, aPath) {
                if (aRoot === "") {
                    aRoot = ".";
                }
                if (aPath === "") {
                    aPath = ".";
                }
                var aPathUrl = urlParse(aPath);
                var aRootUrl = urlParse(aRoot);
                if (aRootUrl) {
                    aRoot = aRootUrl.path || '/';
                }

                // `join(foo, '//www.example.org')`
                if (aPathUrl && !aPathUrl.scheme) {
                    if (aRootUrl) {
                        aPathUrl.scheme = aRootUrl.scheme;
                    }
                    return urlGenerate(aPathUrl);
                }

                if (aPathUrl || aPath.match(dataUrlRegexp)) {
                    return aPath;
                }

                // `join('http://', 'www.example.com')`
                if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
                    aRootUrl.host = aPath;
                    return urlGenerate(aRootUrl);
                }

                var joined = aPath.charAt(0) === '/'
                    ? aPath
                    : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

                if (aRootUrl) {
                    aRootUrl.path = joined;
                    return urlGenerate(aRootUrl);
                }
                return joined;
            }

            exports.join = join;

            exports.isAbsolute = function (aPath) {
                return aPath.charAt(0) === '/' || !!aPath.match(urlRegexp);
            };

            /**
             * Make a path relative to a URL or another path.
             *
             * @param aRoot The root path or URL.
             * @param aPath The path or URL to be made relative to aRoot.
             */
            function relative(aRoot, aPath) {
                if (aRoot === "") {
                    aRoot = ".";
                }

                aRoot = aRoot.replace(/\/$/, '');

                // It is possible for the path to be above the root. In this case, simply
                // checking whether the root is a prefix of the path won't work. Instead, we
                // need to remove components from the root one by one, until either we find
                // a prefix that fits, or we run out of components to remove.
                var level = 0;
                while (aPath.indexOf(aRoot + '/') !== 0) {
                    var index = aRoot.lastIndexOf("/");
                    if (index < 0) {
                        return aPath;
                    }

                    // If the only part of the root that is left is the scheme (i.e. http://,
                    // file:///, etc.), one or more slashes (/), or simply nothing at all, we
                    // have exhausted all components, so the path is not relative to the root.
                    aRoot = aRoot.slice(0, index);
                    if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
                        return aPath;
                    }

                    ++level;
                }

                // Make sure we add a "../" for each component we removed from the root.
                return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
            }

            exports.relative = relative;

            /**
             * Because behavior goes wacky when you set `__proto__` on objects, we
             * have to prefix all the strings in our set with an arbitrary character.
             *
             * See https://github.com/mozilla/source-map/pull/31 and
             * https://github.com/mozilla/source-map/issues/30
             *
             * @param String aStr
             */
            function toSetString(aStr) {
                return '$' + aStr;
            }

            exports.toSetString = toSetString;

            function fromSetString(aStr) {
                return aStr.substr(1);
            }

            exports.fromSetString = fromSetString;

            /**
             * Comparator between two mappings where the original positions are compared.
             *
             * Optionally pass in `true` as `onlyCompareGenerated` to consider two
             * mappings with the same original source/line/column, but different generated
             * line and column the same. Useful when searching for a mapping with a
             * stubbed out mapping.
             */
            function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
                var cmp = mappingA.source - mappingB.source;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0 || onlyCompareOriginal) {
                    return cmp;
                }

                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp;
                }

                return mappingA.name - mappingB.name;
            }

            exports.compareByOriginalPositions = compareByOriginalPositions;

            /**
             * Comparator between two mappings with deflated source and name indices where
             * the generated positions are compared.
             *
             * Optionally pass in `true` as `onlyCompareGenerated` to consider two
             * mappings with the same generated line and column, but different
             * source/name/original line and column the same. Useful when searching for a
             * mapping with a stubbed out mapping.
             */
            function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
                var cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0 || onlyCompareGenerated) {
                    return cmp;
                }

                cmp = mappingA.source - mappingB.source;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0) {
                    return cmp;
                }

                return mappingA.name - mappingB.name;
            }

            exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

            function strcmp(aStr1, aStr2) {
                if (aStr1 === aStr2) {
                    return 0;
                }

                if (aStr1 > aStr2) {
                    return 1;
                }

                return -1;
            }

            /**
             * Comparator between two mappings with inflated source and name strings where
             * the generated positions are compared.
             */
            function compareByGeneratedPositionsInflated(mappingA, mappingB) {
                var cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = strcmp(mappingA.source, mappingB.source);
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp;
                }

                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0) {
                    return cmp;
                }

                return strcmp(mappingA.name, mappingB.name);
            }

            exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
        }

    }, {}], 20: [function (require, module, exports) {
        /*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
        exports.SourceMapGenerator = require('./lib/source-map-generator').SourceMapGenerator;
        exports.SourceMapConsumer = require('./lib/source-map-consumer').SourceMapConsumer;
        exports.SourceNode = require('./lib/source-node').SourceNode;

    }, {"./lib/source-map-consumer": 16, "./lib/source-map-generator": 17, "./lib/source-node": 18}], 21: [function (require, module, exports) {
        var sys = require("util");
        var MOZ_SourceMap = require("source-map");
        var UglifyJS = exports;
        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function array_to_hash(a) {
            var ret = Object.create(null);
            for (var i = 0; i < a.length; ++i)
                ret[a[i]] = true;
            return ret;
        };

        function slice(a, start) {
            return Array.prototype.slice.call(a, start || 0);
        };

        function characters(str) {
            return str.split("");
        };

        function member(name, array) {
            for (var i = array.length; --i >= 0;)
                if (array[i] == name)
                    return true;
            return false;
        };

        function find_if(func, array) {
            for (var i = 0, n = array.length; i < n; ++i) {
                if (func(array[i]))
                    return array[i];
            }
        };

        function repeat_string(str, i) {
            if (i <= 0) return "";
            if (i == 1) return str;
            var d = repeat_string(str, i >> 1);
            d += d;
            if (i & 1) d += str;
            return d;
        };

        function DefaultsError(msg, defs) {
            Error.call(this, msg);
            this.msg = msg;
            this.defs = defs;
        };
        DefaultsError.prototype = Object.create(Error.prototype);
        DefaultsError.prototype.constructor = DefaultsError;

        DefaultsError.croak = function (msg, defs) {
            throw new DefaultsError(msg, defs);
        };

        function defaults(args, defs, croak) {
            if (args === true)
                args = {};
            var ret = args || {};
            if (croak) for (var i in ret) if (ret.hasOwnProperty(i) && !defs.hasOwnProperty(i))
                DefaultsError.croak("`" + i + "` is not a supported option", defs);
            for (var i in defs) if (defs.hasOwnProperty(i)) {
                ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
            }
            return ret;
        };

        function merge(obj, ext) {
            var count = 0;
            for (var i in ext) if (ext.hasOwnProperty(i)) {
                obj[i] = ext[i];
                count++;
            }
            return count;
        };

        function noop() {
        };

        var MAP = (function () {
            function MAP(a, f, backwards) {
                var ret = [], top = [], i;

                function doit() {
                    var val = f(a[i], i);
                    var is_last = val instanceof Last;
                    if (is_last) val = val.v;
                    if (val instanceof AtTop) {
                        val = val.v;
                        if (val instanceof Splice) {
                            top.push.apply(top, backwards ? val.v.slice().reverse() : val.v);
                        } else {
                            top.push(val);
                        }
                    } else if (val !== skip) {
                        if (val instanceof Splice) {
                            ret.push.apply(ret, backwards ? val.v.slice().reverse() : val.v);
                        } else {
                            ret.push(val);
                        }
                    }
                    return is_last;
                };
                if (a instanceof Array) {
                    if (backwards) {
                        for (i = a.length; --i >= 0;) if (doit()) break;
                        ret.reverse();
                        top.reverse();
                    } else {
                        for (i = 0; i < a.length; ++i) if (doit()) break;
                    }
                } else {
                    for (i in a) if (a.hasOwnProperty(i)) if (doit()) break;
                }
                return top.concat(ret);
            };
            MAP.at_top = function (val) {
                return new AtTop(val)
            };
            MAP.splice = function (val) {
                return new Splice(val)
            };
            MAP.last = function (val) {
                return new Last(val)
            };
            var skip = MAP.skip = {};

            function AtTop(val) {
                this.v = val
            };

            function Splice(val) {
                this.v = val
            };

            function Last(val) {
                this.v = val
            };
            return MAP;
        })();

        function push_uniq(array, el) {
            if (array.indexOf(el) < 0)
                array.push(el);
        };

        function string_template(text, props) {
            return text.replace(/\{(.+?)\}/g, function (str, p) {
                return props[p];
            });
        };

        function remove(array, el) {
            for (var i = array.length; --i >= 0;) {
                if (array[i] === el) array.splice(i, 1);
            }
        };

        function mergeSort(array, cmp) {
            if (array.length < 2) return array.slice();

            function merge(a, b) {
                var r = [], ai = 0, bi = 0, i = 0;
                while (ai < a.length && bi < b.length) {
                    cmp(a[ai], b[bi]) <= 0
                        ? r[i++] = a[ai++]
                        : r[i++] = b[bi++];
                }
                if (ai < a.length) r.push.apply(r, a.slice(ai));
                if (bi < b.length) r.push.apply(r, b.slice(bi));
                return r;
            };

            function _ms(a) {
                if (a.length <= 1)
                    return a;
                var m = Math.floor(a.length / 2), left = a.slice(0, m), right = a.slice(m);
                left = _ms(left);
                right = _ms(right);
                return merge(left, right);
            };
            return _ms(array);
        };

        function set_difference(a, b) {
            return a.filter(function (el) {
                return b.indexOf(el) < 0;
            });
        };

        function set_intersection(a, b) {
            return a.filter(function (el) {
                return b.indexOf(el) >= 0;
            });
        };

// this function is taken from Acorn [1], written by Marijn Haverbeke
// [1] https://github.com/marijnh/acorn
        function makePredicate(words) {
            if (!(words instanceof Array)) words = words.split(" ");
            var f = "", cats = [];
            out: for (var i = 0; i < words.length; ++i) {
                for (var j = 0; j < cats.length; ++j)
                    if (cats[j][0].length == words[i].length) {
                        cats[j].push(words[i]);
                        continue out;
                    }
                cats.push([words[i]]);
            }

            function compareTo(arr) {
                if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
                f += "switch(str){";
                for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
                f += "return true}return false;";
            }

            // When there are more than three length categories, an outer
            // switch first dispatches on the lengths, to save on comparisons.
            if (cats.length > 3) {
                cats.sort(function (a, b) {
                    return b.length - a.length;
                });
                f += "switch(str.length){";
                for (var i = 0; i < cats.length; ++i) {
                    var cat = cats[i];
                    f += "case " + cat[0].length + ":";
                    compareTo(cat);
                }
                f += "}";
                // Otherwise, simply generate a flat `switch` statement.
            } else {
                compareTo(words);
            }
            return new Function("str", f);
        };

        function all(array, predicate) {
            for (var i = array.length; --i >= 0;)
                if (!predicate(array[i]))
                    return false;
            return true;
        };

        function Dictionary() {
            this._values = Object.create(null);
            this._size = 0;
        };
        Dictionary.prototype = {
            set: function (key, val) {
                if (!this.has(key)) ++this._size;
                this._values["$" + key] = val;
                return this;
            },
            add: function (key, val) {
                if (this.has(key)) {
                    this.get(key).push(val);
                } else {
                    this.set(key, [val]);
                }
                return this;
            },
            get: function (key) {
                return this._values["$" + key]
            },
            del: function (key) {
                if (this.has(key)) {
                    --this._size;
                    delete this._values["$" + key];
                }
                return this;
            },
            has: function (key) {
                return ("$" + key) in this._values
            },
            each: function (f) {
                for (var i in this._values)
                    f(this._values[i], i.substr(1));
            },
            size: function () {
                return this._size;
            },
            map: function (f) {
                var ret = [];
                for (var i in this._values)
                    ret.push(f(this._values[i], i.substr(1)));
                return ret;
            },
            toObject: function () {
                return this._values
            }
        };
        Dictionary.fromObject = function (obj) {
            var dict = new Dictionary();
            dict._size = merge(dict._values, obj);
            return dict;
        };

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function DEFNODE(type, props, methods, base) {
            if (arguments.length < 4) base = AST_Node;
            if (!props) props = [];
            else props = props.split(/\s+/);
            var self_props = props;
            if (base && base.PROPS)
                props = props.concat(base.PROPS);
            var code = "return function AST_" + type + "(props){ if (props) { ";
            for (var i = props.length; --i >= 0;) {
                code += "this." + props[i] + " = props." + props[i] + ";";
            }
            var proto = base && new base;
            if (proto && proto.initialize || (methods && methods.initialize))
                code += "this.initialize();";
            code += "}}";
            var ctor = new Function(code)();
            if (proto) {
                ctor.prototype = proto;
                ctor.BASE = base;
            }
            if (base) base.SUBCLASSES.push(ctor);
            ctor.prototype.CTOR = ctor;
            ctor.PROPS = props || null;
            ctor.SELF_PROPS = self_props;
            ctor.SUBCLASSES = [];
            if (type) {
                ctor.prototype.TYPE = ctor.TYPE = type;
            }
            if (methods) for (i in methods) if (methods.hasOwnProperty(i)) {
                if (/^\$/.test(i)) {
                    ctor[i.substr(1)] = methods[i];
                } else {
                    ctor.prototype[i] = methods[i];
                }
            }
            ctor.DEFMETHOD = function (name, method) {
                this.prototype[name] = method;
            };
            exports["AST_" + type] = ctor;
            return ctor;
        };

        var AST_Token = DEFNODE("Token", "type value line col pos endline endcol endpos nlb comments_before file raw", {}, null);

        var AST_Node = DEFNODE("Node", "start end", {
            clone: function () {
                return new this.CTOR(this);
            },
            $documentation: "Base class of all AST nodes",
            $propdoc: {
                start: "[AST_Token] The first token of this node",
                end: "[AST_Token] The last token of this node"
            },
            _walk: function (visitor) {
                return visitor._visit(this);
            },
            walk: function (visitor) {
                return this._walk(visitor); // not sure the indirection will be any help
            }
        }, null);

        AST_Node.warn_function = null;
        AST_Node.warn = function (txt, props) {
            if (AST_Node.warn_function)
                AST_Node.warn_function(string_template(txt, props));
        };

        /* -----[ statements ]----- */

        var AST_Statement = DEFNODE("Statement", null, {
            $documentation: "Base class of all statements",
        });

        var AST_Debugger = DEFNODE("Debugger", null, {
            $documentation: "Represents a debugger statement",
        }, AST_Statement);

        var AST_Directive = DEFNODE("Directive", "value scope quote", {
            $documentation: "Represents a directive, like \"use strict\";",
            $propdoc: {
                value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
                scope: "[AST_Scope/S] The scope that this directive affects",
                quote: "[string] the original quote character"
            },
        }, AST_Statement);

        var AST_SimpleStatement = DEFNODE("SimpleStatement", "body", {
            $documentation: "A statement consisting of an expression, i.e. a = 1 + 2",
            $propdoc: {
                body: "[AST_Node] an expression node (should not be instanceof AST_Statement)"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.body._walk(visitor);
                });
            }
        }, AST_Statement);

        function walk_body(node, visitor) {
            if (node.body instanceof AST_Statement) {
                node.body._walk(visitor);
            } else node.body.forEach(function (stat) {
                stat._walk(visitor);
            });
        };

        var AST_Block = DEFNODE("Block", "body", {
            $documentation: "A body of statements (usually bracketed)",
            $propdoc: {
                body: "[AST_Statement*] an array of statements"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    walk_body(this, visitor);
                });
            }
        }, AST_Statement);

        var AST_BlockStatement = DEFNODE("BlockStatement", null, {
            $documentation: "A block statement",
        }, AST_Block);

        var AST_EmptyStatement = DEFNODE("EmptyStatement", null, {
            $documentation: "The empty statement (empty block or simply a semicolon)",
            _walk: function (visitor) {
                return visitor._visit(this);
            }
        }, AST_Statement);

        var AST_StatementWithBody = DEFNODE("StatementWithBody", "body", {
            $documentation: "Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",
            $propdoc: {
                body: "[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.body._walk(visitor);
                });
            }
        }, AST_Statement);

        var AST_LabeledStatement = DEFNODE("LabeledStatement", "label", {
            $documentation: "Statement with a label",
            $propdoc: {
                label: "[AST_Label] a label definition"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.label._walk(visitor);
                    this.body._walk(visitor);
                });
            }
        }, AST_StatementWithBody);

        var AST_IterationStatement = DEFNODE("IterationStatement", null, {
            $documentation: "Internal class.  All loops inherit from it."
        }, AST_StatementWithBody);

        var AST_DWLoop = DEFNODE("DWLoop", "condition", {
            $documentation: "Base class for do/while statements",
            $propdoc: {
                condition: "[AST_Node] the loop condition.  Should not be instanceof AST_Statement"
            }
        }, AST_IterationStatement);

        var AST_Do = DEFNODE("Do", null, {
            $documentation: "A `do` statement",
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.body._walk(visitor);
                    this.condition._walk(visitor);
                });
            }
        }, AST_DWLoop);

        var AST_While = DEFNODE("While", null, {
            $documentation: "A `while` statement",
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.condition._walk(visitor);
                    this.body._walk(visitor);
                });
            }
        }, AST_DWLoop);

        var AST_For = DEFNODE("For", "init condition step", {
            $documentation: "A `for` statement",
            $propdoc: {
                init: "[AST_Node?] the `for` initialization code, or null if empty",
                condition: "[AST_Node?] the `for` termination clause, or null if empty",
                step: "[AST_Node?] the `for` update clause, or null if empty"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    if (this.init) this.init._walk(visitor);
                    if (this.condition) this.condition._walk(visitor);
                    if (this.step) this.step._walk(visitor);
                    this.body._walk(visitor);
                });
            }
        }, AST_IterationStatement);

        var AST_ForIn = DEFNODE("ForIn", "init name object", {
            $documentation: "A `for ... in` statement",
            $propdoc: {
                init: "[AST_Node] the `for/in` initialization code",
                name: "[AST_SymbolRef?] the loop variable, only if `init` is AST_Var",
                object: "[AST_Node] the object that we're looping through"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.init._walk(visitor);
                    this.object._walk(visitor);
                    this.body._walk(visitor);
                });
            }
        }, AST_IterationStatement);

        var AST_With = DEFNODE("With", "expression", {
            $documentation: "A `with` statement",
            $propdoc: {
                expression: "[AST_Node] the `with` expression"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                    this.body._walk(visitor);
                });
            }
        }, AST_StatementWithBody);

        /* -----[ scope and functions ]----- */

        var AST_Scope = DEFNODE("Scope", "directives variables functions uses_with uses_eval parent_scope enclosed cname", {
            $documentation: "Base class for all statements introducing a lexical scope",
            $propdoc: {
                directives: "[string*/S] an array of directives declared in this scope",
                variables: "[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",
                functions: "[Object/S] like `variables`, but only lists function declarations",
                uses_with: "[boolean/S] tells whether this scope uses the `with` statement",
                uses_eval: "[boolean/S] tells whether this scope contains a direct call to the global `eval`",
                parent_scope: "[AST_Scope?/S] link to the parent scope",
                enclosed: "[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",
                cname: "[integer/S] current index for mangling variables (used internally by the mangler)",
            },
        }, AST_Block);

        var AST_Toplevel = DEFNODE("Toplevel", "globals", {
            $documentation: "The toplevel scope",
            $propdoc: {
                globals: "[Object/S] a map of name -> SymbolDef for all undeclared names",
            },
            wrap_enclose: function (arg_parameter_pairs) {
                var self = this;
                var args = [];
                var parameters = [];

                arg_parameter_pairs.forEach(function (pair) {
                    var splitAt = pair.lastIndexOf(":");

                    args.push(pair.substr(0, splitAt));
                    parameters.push(pair.substr(splitAt + 1));
                });

                var wrapped_tl = "(function(" + parameters.join(",") + "){ '$ORIG'; })(" + args.join(",") + ")";
                wrapped_tl = parse(wrapped_tl);
                wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node) {
                    if (node instanceof AST_Directive && node.value == "$ORIG") {
                        return MAP.splice(self.body);
                    }
                }));
                return wrapped_tl;
            },
            wrap_commonjs: function (name, export_all) {
                var self = this;
                var to_export = [];
                if (export_all) {
                    self.figure_out_scope();
                    self.walk(new TreeWalker(function (node) {
                        if (node instanceof AST_SymbolDeclaration && node.definition().global) {
                            if (!find_if(function (n) {
                                return n.name == node.name
                            }, to_export))
                                to_export.push(node);
                        }
                    }));
                }
                var wrapped_tl = "(function(exports, global){ '$ORIG'; '$EXPORTS'; global['" + name + "'] = exports; }({}, (function(){return this}())))";
                wrapped_tl = parse(wrapped_tl);
                wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node) {
                    if (node instanceof AST_Directive) {
                        switch (node.value) {
                            case "$ORIG":
                                return MAP.splice(self.body);
                            case "$EXPORTS":
                                var body = [];
                                to_export.forEach(function (sym) {
                                    body.push(new AST_SimpleStatement({
                                        body: new AST_Assign({
                                            left: new AST_Sub({
                                                expression: new AST_SymbolRef({name: "exports"}),
                                                property: new AST_String({value: sym.name}),
                                            }),
                                            operator: "=",
                                            right: new AST_SymbolRef(sym),
                                        }),
                                    }));
                                });
                                return MAP.splice(body);
                        }
                    }
                }));
                return wrapped_tl;
            }
        }, AST_Scope);

        var AST_Lambda = DEFNODE("Lambda", "name argnames uses_arguments", {
            $documentation: "Base class for functions",
            $propdoc: {
                name: "[AST_SymbolDeclaration?] the name of this function",
                argnames: "[AST_SymbolFunarg*] array of function arguments",
                uses_arguments: "[boolean/S] tells whether this function accesses the arguments array"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    if (this.name) this.name._walk(visitor);
                    this.argnames.forEach(function (arg) {
                        arg._walk(visitor);
                    });
                    walk_body(this, visitor);
                });
            }
        }, AST_Scope);

        var AST_Accessor = DEFNODE("Accessor", null, {
            $documentation: "A setter/getter function.  The `name` property is always null."
        }, AST_Lambda);

        var AST_Function = DEFNODE("Function", null, {
            $documentation: "A function expression"
        }, AST_Lambda);

        var AST_Defun = DEFNODE("Defun", null, {
            $documentation: "A function definition"
        }, AST_Lambda);

        /* -----[ JUMPS ]----- */

        var AST_Jump = DEFNODE("Jump", null, {
            $documentation: "Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"
        }, AST_Statement);

        var AST_Exit = DEFNODE("Exit", "value", {
            $documentation: "Base class for “exits” (`return` and `throw`)",
            $propdoc: {
                value: "[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"
            },
            _walk: function (visitor) {
                return visitor._visit(this, this.value && function () {
                    this.value._walk(visitor);
                });
            }
        }, AST_Jump);

        var AST_Return = DEFNODE("Return", null, {
            $documentation: "A `return` statement"
        }, AST_Exit);

        var AST_Throw = DEFNODE("Throw", null, {
            $documentation: "A `throw` statement"
        }, AST_Exit);

        var AST_LoopControl = DEFNODE("LoopControl", "label", {
            $documentation: "Base class for loop control statements (`break` and `continue`)",
            $propdoc: {
                label: "[AST_LabelRef?] the label, or null if none",
            },
            _walk: function (visitor) {
                return visitor._visit(this, this.label && function () {
                    this.label._walk(visitor);
                });
            }
        }, AST_Jump);

        var AST_Break = DEFNODE("Break", null, {
            $documentation: "A `break` statement"
        }, AST_LoopControl);

        var AST_Continue = DEFNODE("Continue", null, {
            $documentation: "A `continue` statement"
        }, AST_LoopControl);

        /* -----[ IF ]----- */

        var AST_If = DEFNODE("If", "condition alternative", {
            $documentation: "A `if` statement",
            $propdoc: {
                condition: "[AST_Node] the `if` condition",
                alternative: "[AST_Statement?] the `else` part, or null if not present"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.condition._walk(visitor);
                    this.body._walk(visitor);
                    if (this.alternative) this.alternative._walk(visitor);
                });
            }
        }, AST_StatementWithBody);

        /* -----[ SWITCH ]----- */

        var AST_Switch = DEFNODE("Switch", "expression", {
            $documentation: "A `switch` statement",
            $propdoc: {
                expression: "[AST_Node] the `switch` “discriminant”"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                    walk_body(this, visitor);
                });
            }
        }, AST_Block);

        var AST_SwitchBranch = DEFNODE("SwitchBranch", null, {
            $documentation: "Base class for `switch` branches",
        }, AST_Block);

        var AST_Default = DEFNODE("Default", null, {
            $documentation: "A `default` switch branch",
        }, AST_SwitchBranch);

        var AST_Case = DEFNODE("Case", "expression", {
            $documentation: "A `case` switch branch",
            $propdoc: {
                expression: "[AST_Node] the `case` expression"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                    walk_body(this, visitor);
                });
            }
        }, AST_SwitchBranch);

        /* -----[ EXCEPTIONS ]----- */

        var AST_Try = DEFNODE("Try", "bcatch bfinally", {
            $documentation: "A `try` statement",
            $propdoc: {
                bcatch: "[AST_Catch?] the catch block, or null if not present",
                bfinally: "[AST_Finally?] the finally block, or null if not present"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    walk_body(this, visitor);
                    if (this.bcatch) this.bcatch._walk(visitor);
                    if (this.bfinally) this.bfinally._walk(visitor);
                });
            }
        }, AST_Block);

        var AST_Catch = DEFNODE("Catch", "argname", {
            $documentation: "A `catch` node; only makes sense as part of a `try` statement",
            $propdoc: {
                argname: "[AST_SymbolCatch] symbol for the exception"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.argname._walk(visitor);
                    walk_body(this, visitor);
                });
            }
        }, AST_Block);

        var AST_Finally = DEFNODE("Finally", null, {
            $documentation: "A `finally` node; only makes sense as part of a `try` statement"
        }, AST_Block);

        /* -----[ VAR/CONST ]----- */

        var AST_Definitions = DEFNODE("Definitions", "definitions", {
            $documentation: "Base class for `var` or `const` nodes (variable declarations/initializations)",
            $propdoc: {
                definitions: "[AST_VarDef*] array of variable definitions"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.definitions.forEach(function (def) {
                        def._walk(visitor);
                    });
                });
            }
        }, AST_Statement);

        var AST_Var = DEFNODE("Var", null, {
            $documentation: "A `var` statement"
        }, AST_Definitions);

        var AST_Const = DEFNODE("Const", null, {
            $documentation: "A `const` statement"
        }, AST_Definitions);

        var AST_VarDef = DEFNODE("VarDef", "name value", {
            $documentation: "A variable declaration; only appears in a AST_Definitions node",
            $propdoc: {
                name: "[AST_SymbolVar|AST_SymbolConst] name of the variable",
                value: "[AST_Node?] initializer, or null of there's no initializer"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.name._walk(visitor);
                    if (this.value) this.value._walk(visitor);
                });
            }
        });

        /* -----[ OTHER ]----- */

        var AST_Call = DEFNODE("Call", "expression args", {
            $documentation: "A function call expression",
            $propdoc: {
                expression: "[AST_Node] expression to invoke as function",
                args: "[AST_Node*] array of arguments"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                    this.args.forEach(function (arg) {
                        arg._walk(visitor);
                    });
                });
            }
        });

        var AST_New = DEFNODE("New", null, {
            $documentation: "An object instantiation.  Derives from a function call since it has exactly the same properties"
        }, AST_Call);

        var AST_Seq = DEFNODE("Seq", "car cdr", {
            $documentation: "A sequence expression (two comma-separated expressions)",
            $propdoc: {
                car: "[AST_Node] first element in sequence",
                cdr: "[AST_Node] second element in sequence"
            },
            $cons: function (x, y) {
                var seq = new AST_Seq(x);
                seq.car = x;
                seq.cdr = y;
                return seq;
            },
            $from_array: function (array) {
                if (array.length == 0) return null;
                if (array.length == 1) return array[0].clone();
                var list = null;
                for (var i = array.length; --i >= 0;) {
                    list = AST_Seq.cons(array[i], list);
                }
                var p = list;
                while (p) {
                    if (p.cdr && !p.cdr.cdr) {
                        p.cdr = p.cdr.car;
                        break;
                    }
                    p = p.cdr;
                }
                return list;
            },
            to_array: function () {
                var p = this, a = [];
                while (p) {
                    a.push(p.car);
                    if (p.cdr && !(p.cdr instanceof AST_Seq)) {
                        a.push(p.cdr);
                        break;
                    }
                    p = p.cdr;
                }
                return a;
            },
            add: function (node) {
                var p = this;
                while (p) {
                    if (!(p.cdr instanceof AST_Seq)) {
                        var cell = AST_Seq.cons(p.cdr, node);
                        return p.cdr = cell;
                    }
                    p = p.cdr;
                }
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.car._walk(visitor);
                    if (this.cdr) this.cdr._walk(visitor);
                });
            }
        });

        var AST_PropAccess = DEFNODE("PropAccess", "expression property", {
            $documentation: "Base class for property access expressions, i.e. `a.foo` or `a[\"foo\"]`",
            $propdoc: {
                expression: "[AST_Node] the “container” expression",
                property: "[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"
            }
        });

        var AST_Dot = DEFNODE("Dot", null, {
            $documentation: "A dotted property access expression",
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                });
            }
        }, AST_PropAccess);

        var AST_Sub = DEFNODE("Sub", null, {
            $documentation: "Index-style property access, i.e. `a[\"foo\"]`",
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                    this.property._walk(visitor);
                });
            }
        }, AST_PropAccess);

        var AST_Unary = DEFNODE("Unary", "operator expression", {
            $documentation: "Base class for unary expressions",
            $propdoc: {
                operator: "[string] the operator",
                expression: "[AST_Node] expression that this unary operator applies to"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.expression._walk(visitor);
                });
            }
        });

        var AST_UnaryPrefix = DEFNODE("UnaryPrefix", null, {
            $documentation: "Unary prefix expression, i.e. `typeof i` or `++i`"
        }, AST_Unary);

        var AST_UnaryPostfix = DEFNODE("UnaryPostfix", null, {
            $documentation: "Unary postfix expression, i.e. `i++`"
        }, AST_Unary);

        var AST_Binary = DEFNODE("Binary", "left operator right", {
            $documentation: "Binary expression, i.e. `a + b`",
            $propdoc: {
                left: "[AST_Node] left-hand side expression",
                operator: "[string] the operator",
                right: "[AST_Node] right-hand side expression"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.left._walk(visitor);
                    this.right._walk(visitor);
                });
            }
        });

        var AST_Conditional = DEFNODE("Conditional", "condition consequent alternative", {
            $documentation: "Conditional expression using the ternary operator, i.e. `a ? b : c`",
            $propdoc: {
                condition: "[AST_Node]",
                consequent: "[AST_Node]",
                alternative: "[AST_Node]"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.condition._walk(visitor);
                    this.consequent._walk(visitor);
                    this.alternative._walk(visitor);
                });
            }
        });

        var AST_Assign = DEFNODE("Assign", null, {
            $documentation: "An assignment expression — `a = b + 5`",
        }, AST_Binary);

        /* -----[ LITERALS ]----- */

        var AST_Array = DEFNODE("Array", "elements", {
            $documentation: "An array literal",
            $propdoc: {
                elements: "[AST_Node*] array of elements"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.elements.forEach(function (el) {
                        el._walk(visitor);
                    });
                });
            }
        });

        var AST_Object = DEFNODE("Object", "properties", {
            $documentation: "An object literal",
            $propdoc: {
                properties: "[AST_ObjectProperty*] array of properties"
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.properties.forEach(function (prop) {
                        prop._walk(visitor);
                    });
                });
            }
        });

        var AST_ObjectProperty = DEFNODE("ObjectProperty", "key value", {
            $documentation: "Base class for literal object properties",
            $propdoc: {
                key: "[string] the property name converted to a string for ObjectKeyVal.  For setters and getters this is an arbitrary AST_Node.",
                value: "[AST_Node] property value.  For setters and getters this is an AST_Function."
            },
            _walk: function (visitor) {
                return visitor._visit(this, function () {
                    this.value._walk(visitor);
                });
            }
        });

        var AST_ObjectKeyVal = DEFNODE("ObjectKeyVal", "quote", {
            $documentation: "A key: value object property",
            $propdoc: {
                quote: "[string] the original quote character"
            }
        }, AST_ObjectProperty);

        var AST_ObjectSetter = DEFNODE("ObjectSetter", null, {
            $documentation: "An object setter property",
        }, AST_ObjectProperty);

        var AST_ObjectGetter = DEFNODE("ObjectGetter", null, {
            $documentation: "An object getter property",
        }, AST_ObjectProperty);

        var AST_Symbol = DEFNODE("Symbol", "scope name thedef", {
            $propdoc: {
                name: "[string] name of this symbol",
                scope: "[AST_Scope/S] the current scope (not necessarily the definition scope)",
                thedef: "[SymbolDef/S] the definition of this symbol"
            },
            $documentation: "Base class for all symbols",
        });

        var AST_SymbolAccessor = DEFNODE("SymbolAccessor", null, {
            $documentation: "The name of a property accessor (setter/getter function)"
        }, AST_Symbol);

        var AST_SymbolDeclaration = DEFNODE("SymbolDeclaration", "init", {
            $documentation: "A declaration symbol (symbol in var/const, function name or argument, symbol in catch)",
            $propdoc: {
                init: "[AST_Node*/S] array of initializers for this declaration."
            }
        }, AST_Symbol);

        var AST_SymbolVar = DEFNODE("SymbolVar", null, {
            $documentation: "Symbol defining a variable",
        }, AST_SymbolDeclaration);

        var AST_SymbolConst = DEFNODE("SymbolConst", null, {
            $documentation: "A constant declaration"
        }, AST_SymbolDeclaration);

        var AST_SymbolFunarg = DEFNODE("SymbolFunarg", null, {
            $documentation: "Symbol naming a function argument",
        }, AST_SymbolVar);

        var AST_SymbolDefun = DEFNODE("SymbolDefun", null, {
            $documentation: "Symbol defining a function",
        }, AST_SymbolDeclaration);

        var AST_SymbolLambda = DEFNODE("SymbolLambda", null, {
            $documentation: "Symbol naming a function expression",
        }, AST_SymbolDeclaration);

        var AST_SymbolCatch = DEFNODE("SymbolCatch", null, {
            $documentation: "Symbol naming the exception in catch",
        }, AST_SymbolDeclaration);

        var AST_Label = DEFNODE("Label", "references", {
            $documentation: "Symbol naming a label (declaration)",
            $propdoc: {
                references: "[AST_LoopControl*] a list of nodes referring to this label"
            },
            initialize: function () {
                this.references = [];
                this.thedef = this;
            }
        }, AST_Symbol);

        var AST_SymbolRef = DEFNODE("SymbolRef", null, {
            $documentation: "Reference to some symbol (not definition/declaration)",
        }, AST_Symbol);

        var AST_LabelRef = DEFNODE("LabelRef", null, {
            $documentation: "Reference to a label symbol",
        }, AST_Symbol);

        var AST_This = DEFNODE("This", null, {
            $documentation: "The `this` symbol",
        }, AST_Symbol);

        var AST_Constant = DEFNODE("Constant", null, {
            $documentation: "Base class for all constants",
            getValue: function () {
                return this.value;
            }
        });

        var AST_String = DEFNODE("String", "value quote", {
            $documentation: "A string literal",
            $propdoc: {
                value: "[string] the contents of this string",
                quote: "[string] the original quote character"
            }
        }, AST_Constant);

        var AST_Number = DEFNODE("Number", "value literal", {
            $documentation: "A number literal",
            $propdoc: {
                value: "[number] the numeric value",
                literal: "[string] numeric value as string (optional)"
            }
        }, AST_Constant);

        var AST_RegExp = DEFNODE("RegExp", "value", {
            $documentation: "A regexp literal",
            $propdoc: {
                value: "[RegExp] the actual regexp"
            }
        }, AST_Constant);

        var AST_Atom = DEFNODE("Atom", null, {
            $documentation: "Base class for atoms",
        }, AST_Constant);

        var AST_Null = DEFNODE("Null", null, {
            $documentation: "The `null` atom",
            value: null
        }, AST_Atom);

        var AST_NaN = DEFNODE("NaN", null, {
            $documentation: "The impossible value",
            value: 0 / 0
        }, AST_Atom);

        var AST_Undefined = DEFNODE("Undefined", null, {
            $documentation: "The `undefined` value",
            value: (function () {
            }())
        }, AST_Atom);

        var AST_Hole = DEFNODE("Hole", null, {
            $documentation: "A hole in an array",
            value: (function () {
            }())
        }, AST_Atom);

        var AST_Infinity = DEFNODE("Infinity", null, {
            $documentation: "The `Infinity` value",
            value: 1 / 0
        }, AST_Atom);

        var AST_Boolean = DEFNODE("Boolean", null, {
            $documentation: "Base class for booleans",
        }, AST_Atom);

        var AST_False = DEFNODE("False", null, {
            $documentation: "The `false` atom",
            value: false
        }, AST_Boolean);

        var AST_True = DEFNODE("True", null, {
            $documentation: "The `true` atom",
            value: true
        }, AST_Boolean);

        /* -----[ TreeWalker ]----- */

        function TreeWalker(callback) {
            this.visit = callback;
            this.stack = [];
            this.directives = Object.create(null);
        };
        TreeWalker.prototype = {
            _visit: function (node, descend) {
                this.push(node);
                var ret = this.visit(node, descend ? function () {
                    descend.call(node);
                } : noop);
                if (!ret && descend) {
                    descend.call(node);
                }
                this.pop(node);
                return ret;
            },
            parent: function (n) {
                return this.stack[this.stack.length - 2 - (n || 0)];
            },
            push: function (node) {
                if (node instanceof AST_Lambda) {
                    this.directives = Object.create(this.directives);
                } else if (node instanceof AST_Directive) {
                    this.directives[node.value] = this.directives[node.value] ? "up" : true;
                }
                this.stack.push(node);
            },
            pop: function (node) {
                this.stack.pop();
                if (node instanceof AST_Lambda) {
                    this.directives = Object.getPrototypeOf(this.directives);
                }
            },
            self: function () {
                return this.stack[this.stack.length - 1];
            },
            find_parent: function (type) {
                var stack = this.stack;
                for (var i = stack.length; --i >= 0;) {
                    var x = stack[i];
                    if (x instanceof type) return x;
                }
            },
            has_directive: function (type) {
                var dir = this.directives[type];
                if (dir) return dir;
                var node = this.stack[this.stack.length - 1];
                if (node instanceof AST_Scope) {
                    for (var i = 0; i < node.body.length; ++i) {
                        var st = node.body[i];
                        if (!(st instanceof AST_Directive)) break;
                        if (st.value == type) return true;
                    }
                }
            },
            in_boolean_context: function () {
                var stack = this.stack;
                var i = stack.length, self = stack[--i];
                while (i > 0) {
                    var p = stack[--i];
                    if ((p instanceof AST_If && p.condition === self) ||
                        (p instanceof AST_Conditional && p.condition === self) ||
                        (p instanceof AST_DWLoop && p.condition === self) ||
                        (p instanceof AST_For && p.condition === self) ||
                        (p instanceof AST_UnaryPrefix && p.operator == "!" && p.expression === self)) {
                        return true;
                    }
                    if (!(p instanceof AST_Binary && (p.operator == "&&" || p.operator == "||")))
                        return false;
                    self = p;
                }
            },
            loopcontrol_target: function (label) {
                var stack = this.stack;
                if (label) for (var i = stack.length; --i >= 0;) {
                    var x = stack[i];
                    if (x instanceof AST_LabeledStatement && x.label.name == label.name) {
                        return x.body;
                    }
                } else for (var i = stack.length; --i >= 0;) {
                    var x = stack[i];
                    if (x instanceof AST_Switch || x instanceof AST_IterationStatement)
                        return x;
                }
            }
        };

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>
         Parser based on parse-js (http://marijn.haverbeke.nl/parse-js/).

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        var KEYWORDS = 'break case catch const continue debugger default delete do else finally for function if in instanceof new return switch throw try typeof var void while with';
        var KEYWORDS_ATOM = 'false null true';
        var RESERVED_WORDS = 'abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized this throws transient volatile yield'
            + " " + KEYWORDS_ATOM + " " + KEYWORDS;
        var KEYWORDS_BEFORE_EXPRESSION = 'return new delete throw else case';

        KEYWORDS = makePredicate(KEYWORDS);
        RESERVED_WORDS = makePredicate(RESERVED_WORDS);
        KEYWORDS_BEFORE_EXPRESSION = makePredicate(KEYWORDS_BEFORE_EXPRESSION);
        KEYWORDS_ATOM = makePredicate(KEYWORDS_ATOM);

        var OPERATOR_CHARS = makePredicate(characters("+-*&%=<>!?|~^"));

        var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
        var RE_OCT_NUMBER = /^0[0-7]+$/;

        var OPERATORS = makePredicate([
            "in",
            "instanceof",
            "typeof",
            "new",
            "void",
            "delete",
            "++",
            "--",
            "+",
            "-",
            "!",
            "~",
            "&",
            "|",
            "^",
            "*",
            "/",
            "%",
            ">>",
            "<<",
            ">>>",
            "<",
            ">",
            "<=",
            ">=",
            "==",
            "===",
            "!=",
            "!==",
            "?",
            "=",
            "+=",
            "-=",
            "/=",
            "*=",
            "%=",
            ">>=",
            "<<=",
            ">>>=",
            "|=",
            "^=",
            "&=",
            "&&",
            "||"
        ]);

        var WHITESPACE_CHARS = makePredicate(characters(" \u00a0\n\r\t\f\u000b\u200b\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\uFEFF"));

        var PUNC_BEFORE_EXPRESSION = makePredicate(characters("[{(,.;:"));

        var PUNC_CHARS = makePredicate(characters("[]{}(),;:"));

        var REGEXP_MODIFIERS = makePredicate(characters("gmsiy"));

        /* -----[ Tokenizer ]----- */

// regexps adapted from http://xregexp.com/plugins/#unicode
        var UNICODE = {
            letter: new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u052F\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0620-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0800-\\u0815\\u081A\\u0824\\u0828\\u0840-\\u0858\\u08A0-\\u08B2\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971-\\u0980\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0CF1\\u0CF2\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D3A\\u0D3D\\u0D4E\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC-\\u0EDF\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8C\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10C7\\u10CD\\u10D0-\\u10FA\\u10FC-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u167F\\u1681-\\u169A\\u16A0-\\u16EA\\u16EE-\\u16F8\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u18B0-\\u18F5\\u1900-\\u191E\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19AB\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1A20-\\u1A54\\u1AA7\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1BBA-\\u1BE5\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1CE9-\\u1CEC\\u1CEE-\\u1CF1\\u1CF5\\u1CF6\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u209C\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2160-\\u2188\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2CE4\\u2CEB-\\u2CEE\\u2CF2\\u2CF3\\u2D00-\\u2D25\\u2D27\\u2D2D\\u2D30-\\u2D67\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005-\\u3007\\u3021-\\u3029\\u3031-\\u3035\\u3038-\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31BA\\u31F0-\\u31FF\\u3400-\\u4DB5\\u4E00-\\u9FCC\\uA000-\\uA48C\\uA4D0-\\uA4FD\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA66E\\uA67F-\\uA69D\\uA6A0-\\uA6EF\\uA717-\\uA71F\\uA722-\\uA788\\uA78B-\\uA78E\\uA790-\\uA7AD\\uA7B0\\uA7B1\\uA7F7-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA8F2-\\uA8F7\\uA8FB\\uA90A-\\uA925\\uA930-\\uA946\\uA960-\\uA97C\\uA984-\\uA9B2\\uA9CF\\uA9E0-\\uA9E4\\uA9E6-\\uA9EF\\uA9FA-\\uA9FE\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAA60-\\uAA76\\uAA7A\\uAA7E-\\uAAAF\\uAAB1\\uAAB5\\uAAB6\\uAAB9-\\uAABD\\uAAC0\\uAAC2\\uAADB-\\uAADD\\uAAE0-\\uAAEA\\uAAF2-\\uAAF4\\uAB01-\\uAB06\\uAB09-\\uAB0E\\uAB11-\\uAB16\\uAB20-\\uAB26\\uAB28-\\uAB2E\\uAB30-\\uAB5A\\uAB5C-\\uAB5F\\uAB64\\uAB65\\uABC0-\\uABE2\\uAC00-\\uD7A3\\uD7B0-\\uD7C6\\uD7CB-\\uD7FB\\uF900-\\uFA6D\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),
            digit: new RegExp("[\\u0030-\\u0039\\u0660-\\u0669\\u06F0-\\u06F9\\u07C0-\\u07C9\\u0966-\\u096F\\u09E6-\\u09EF\\u0A66-\\u0A6F\\u0AE6-\\u0AEF\\u0B66-\\u0B6F\\u0BE6-\\u0BEF\\u0C66-\\u0C6F\\u0CE6-\\u0CEF\\u0D66-\\u0D6F\\u0DE6-\\u0DEF\\u0E50-\\u0E59\\u0ED0-\\u0ED9\\u0F20-\\u0F29\\u1040-\\u1049\\u1090-\\u1099\\u17E0-\\u17E9\\u1810-\\u1819\\u1946-\\u194F\\u19D0-\\u19D9\\u1A80-\\u1A89\\u1A90-\\u1A99\\u1B50-\\u1B59\\u1BB0-\\u1BB9\\u1C40-\\u1C49\\u1C50-\\u1C59\\uA620-\\uA629\\uA8D0-\\uA8D9\\uA900-\\uA909\\uA9D0-\\uA9D9\\uA9F0-\\uA9F9\\uAA50-\\uAA59\\uABF0-\\uABF9\\uFF10-\\uFF19]"),
            non_spacing_mark: new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065E\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0900-\\u0902\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0955\\u0962\\u0963\\u0981\\u09BC\\u09C1-\\u09C4\\u09CD\\u09E2\\u09E3\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0B01\\u0B3C\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B56\\u0B62\\u0B63\\u0B82\\u0BC0\\u0BCD\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0CBC\\u0CBF\\u0CC6\\u0CCC\\u0CCD\\u0CE2\\u0CE3\\u0D41-\\u0D44\\u0D4D\\u0D62\\u0D63\\u0DCA\\u0DD2-\\u0DD4\\u0DD6\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F90-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1B00-\\u1B03\\u1B34\\u1B36-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1DC0-\\u1DE6\\u1DFD-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA67C\\uA67D\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),
            space_combining_mark: new RegExp("[\\u0903\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0F3E\\u0F3F\\u0F7F\\u102B\\u102C\\u1031\\u1038\\u103B\\u103C\\u1056\\u1057\\u1062-\\u1064\\u1067-\\u106D\\u1083\\u1084\\u1087-\\u108C\\u108F\\u109A-\\u109C\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A19-\\u1A1B\\u1A55\\u1A57\\u1A61\\u1A63\\u1A64\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF2\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BD-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAA7B\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC]"),
            connector_punctuation: new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]")
        };

        function is_letter(code) {
            return (code >= 97 && code <= 122)
                || (code >= 65 && code <= 90)
                || (code >= 0xaa && UNICODE.letter.test(String.fromCharCode(code)));
        };

        function is_digit(code) {
            return code >= 48 && code <= 57;
        };

        function is_alphanumeric_char(code) {
            return is_digit(code) || is_letter(code);
        };

        function is_unicode_digit(code) {
            return UNICODE.digit.test(String.fromCharCode(code));
        }

        function is_unicode_combining_mark(ch) {
            return UNICODE.non_spacing_mark.test(ch) || UNICODE.space_combining_mark.test(ch);
        };

        function is_unicode_connector_punctuation(ch) {
            return UNICODE.connector_punctuation.test(ch);
        };

        function is_identifier(name) {
            return !RESERVED_WORDS(name) && /^[a-z_$][a-z0-9_$]*$/i.test(name);
        };

        function is_identifier_start(code) {
            return code == 36 || code == 95 || is_letter(code);
        };

        function is_identifier_char(ch) {
            var code = ch.charCodeAt(0);
            return is_identifier_start(code)
                || is_digit(code)
                || code == 8204 // \u200c: zero-width non-joiner <ZWNJ>
                || code == 8205 // \u200d: zero-width joiner <ZWJ> (in my ECMA-262 PDF, this is also 200c)
                || is_unicode_combining_mark(ch)
                || is_unicode_connector_punctuation(ch)
                || is_unicode_digit(code)
                ;
        };

        function is_identifier_string(str) {
            return /^[a-z_$][a-z0-9_$]*$/i.test(str);
        };

        function parse_js_number(num) {
            if (RE_HEX_NUMBER.test(num)) {
                return parseInt(num.substr(2), 16);
            } else if (RE_OCT_NUMBER.test(num)) {
                return parseInt(num.substr(1), 8);
            } else {
                var val = parseFloat(num);
                if (val == num) return val;
            }
        };

        function JS_Parse_Error(message, filename, line, col, pos) {
            this.message = message;
            this.filename = filename;
            this.line = line;
            this.col = col;
            this.pos = pos;
            this.stack = new Error().stack;
        };

        JS_Parse_Error.prototype.toString = function () {
            return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
        };

        function js_error(message, filename, line, col, pos) {
            throw new JS_Parse_Error(message, filename, line, col, pos);
        };

        function is_token(token, type, val) {
            return token.type == type && (val == null || token.value == val);
        };

        var EX_EOF = {};

        function tokenizer($TEXT, filename, html5_comments, shebang) {

            var S = {
                text: $TEXT,
                filename: filename,
                pos: 0,
                tokpos: 0,
                line: 1,
                tokline: 0,
                col: 0,
                tokcol: 0,
                newline_before: false,
                regex_allowed: false,
                comments_before: []
            };

            function peek() {
                return S.text.charAt(S.pos);
            };

            function next(signal_eof, in_string) {
                var ch = S.text.charAt(S.pos++);
                if (signal_eof && !ch)
                    throw EX_EOF;
                if ("\r\n\u2028\u2029".indexOf(ch) >= 0) {
                    S.newline_before = S.newline_before || !in_string;
                    ++S.line;
                    S.col = 0;
                    if (!in_string && ch == "\r" && peek() == "\n") {
                        // treat a \r\n sequence as a single \n
                        ++S.pos;
                        ch = "\n";
                    }
                } else {
                    ++S.col;
                }
                return ch;
            };

            function forward(i) {
                while (i-- > 0) next();
            };

            function looking_at(str) {
                return S.text.substr(S.pos, str.length) == str;
            };

            function find(what, signal_eof) {
                var pos = S.text.indexOf(what, S.pos);
                if (signal_eof && pos == -1) throw EX_EOF;
                return pos;
            };

            function start_token() {
                S.tokline = S.line;
                S.tokcol = S.col;
                S.tokpos = S.pos;
            };

            var prev_was_dot = false;

            function token(type, value, is_comment) {
                S.regex_allowed = ((type == "operator" && !UNARY_POSTFIX(value)) ||
                    (type == "keyword" && KEYWORDS_BEFORE_EXPRESSION(value)) ||
                    (type == "punc" && PUNC_BEFORE_EXPRESSION(value)));
                prev_was_dot = (type == "punc" && value == ".");
                var ret = {
                    type: type,
                    value: value,
                    line: S.tokline,
                    col: S.tokcol,
                    pos: S.tokpos,
                    endline: S.line,
                    endcol: S.col,
                    endpos: S.pos,
                    nlb: S.newline_before,
                    file: filename
                };
                if (/^(?:num|string|regexp)$/i.test(type)) {
                    ret.raw = $TEXT.substring(ret.pos, ret.endpos);
                }
                if (!is_comment) {
                    ret.comments_before = S.comments_before;
                    S.comments_before = [];
                    // make note of any newlines in the comments that came before
                    for (var i = 0, len = ret.comments_before.length; i < len; i++) {
                        ret.nlb = ret.nlb || ret.comments_before[i].nlb;
                    }
                }
                S.newline_before = false;
                return new AST_Token(ret);
            };

            function skip_whitespace() {
                var ch;
                while (WHITESPACE_CHARS(ch = peek()) || ch == "\u2028" || ch == "\u2029")
                    next();
            };

            function read_while(pred) {
                var ret = "", ch, i = 0;
                while ((ch = peek()) && pred(ch, i++))
                    ret += next();
                return ret;
            };

            function parse_error(err) {
                js_error(err, filename, S.tokline, S.tokcol, S.tokpos);
            };

            function read_num(prefix) {
                var has_e = false, after_e = false, has_x = false, has_dot = prefix == ".";
                var num = read_while(function (ch, i) {
                    var code = ch.charCodeAt(0);
                    switch (code) {
                        case 120:
                        case 88: // xX
                            return has_x ? false : (has_x = true);
                        case 101:
                        case 69: // eE
                            return has_x ? true : has_e ? false : (has_e = after_e = true);
                        case 45: // -
                            return after_e || (i == 0 && !prefix);
                        case 43: // +
                            return after_e;
                        case (after_e = false, 46): // .
                            return (!has_dot && !has_x && !has_e) ? (has_dot = true) : false;
                    }
                    return is_alphanumeric_char(code);
                });
                if (prefix) num = prefix + num;
                var valid = parse_js_number(num);
                if (!isNaN(valid)) {
                    return token("num", valid);
                } else {
                    parse_error("Invalid syntax: " + num);
                }
            };

            function read_escaped_char(in_string) {
                var ch = next(true, in_string);
                switch (ch.charCodeAt(0)) {
                    case 110 :
                        return "\n";
                    case 114 :
                        return "\r";
                    case 116 :
                        return "\t";
                    case 98  :
                        return "\b";
                    case 118 :
                        return "\u000b"; // \v
                    case 102 :
                        return "\f";
                    case 48  :
                        return "\0";
                    case 120 :
                        return String.fromCharCode(hex_bytes(2)); // \x
                    case 117 :
                        return String.fromCharCode(hex_bytes(4)); // \u
                    case 10  :
                        return ""; // newline
                    case 13  :            // \r
                        if (peek() == "\n") { // DOS newline
                            next(true, in_string);
                            return "";
                        }
                }
                return ch;
            };

            function hex_bytes(n) {
                var num = 0;
                for (; n > 0; --n) {
                    var digit = parseInt(next(true), 16);
                    if (isNaN(digit))
                        parse_error("Invalid hex-character pattern in string");
                    num = (num << 4) | digit;
                }
                return num;
            };

            var read_string = with_eof_error("Unterminated string constant", function (quote_char) {
                var quote = next(), ret = "";
                for (; ;) {
                    var ch = next(true, true);
                    if (ch == "\\") {
                        // read OctalEscapeSequence (XXX: deprecated if "strict mode")
                        // https://github.com/mishoo/UglifyJS/issues/178
                        var octal_len = 0, first = null;
                        ch = read_while(function (ch) {
                            if (ch >= "0" && ch <= "7") {
                                if (!first) {
                                    first = ch;
                                    return ++octal_len;
                                } else if (first <= "3" && octal_len <= 2) return ++octal_len;
                                else if (first >= "4" && octal_len <= 1) return ++octal_len;
                            }
                            return false;
                        });
                        if (octal_len > 0) ch = String.fromCharCode(parseInt(ch, 8));
                        else ch = read_escaped_char(true);
                    } else if (ch == quote) break;
                    ret += ch;
                }
                var tok = token("string", ret);
                tok.quote = quote_char;
                return tok;
            });

            function skip_line_comment(type) {
                var regex_allowed = S.regex_allowed;
                var i = find("\n"), ret;
                if (i == -1) {
                    ret = S.text.substr(S.pos);
                    S.pos = S.text.length;
                } else {
                    ret = S.text.substring(S.pos, i);
                    S.pos = i;
                }
                S.col = S.tokcol + (S.pos - S.tokpos);
                S.comments_before.push(token(type, ret, true));
                S.regex_allowed = regex_allowed;
                return next_token();
            };

            var skip_multiline_comment = with_eof_error("Unterminated multiline comment", function () {
                var regex_allowed = S.regex_allowed;
                var i = find("*/", true);
                var text = S.text.substring(S.pos, i);
                var a = text.split("\n"), n = a.length;
                // update stream position
                S.pos = i + 2;
                S.line += n - 1;
                if (n > 1) S.col = a[n - 1].length;
                else S.col += a[n - 1].length;
                S.col += 2;
                var nlb = S.newline_before = S.newline_before || text.indexOf("\n") >= 0;
                S.comments_before.push(token("comment2", text, true));
                S.regex_allowed = regex_allowed;
                S.newline_before = nlb;
                return next_token();
            });

            function read_name() {
                var backslash = false, name = "", ch, escaped = false, hex;
                while ((ch = peek()) != null) {
                    if (!backslash) {
                        if (ch == "\\") escaped = backslash = true, next();
                        else if (is_identifier_char(ch)) name += next();
                        else break;
                    } else {
                        if (ch != "u") parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                        ch = read_escaped_char();
                        if (!is_identifier_char(ch)) parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                        name += ch;
                        backslash = false;
                    }
                }
                if (KEYWORDS(name) && escaped) {
                    hex = name.charCodeAt(0).toString(16).toUpperCase();
                    name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
                }
                return name;
            };

            var read_regexp = with_eof_error("Unterminated regular expression", function (regexp) {
                var prev_backslash = false, ch, in_class = false;
                while ((ch = next(true))) if (prev_backslash) {
                    regexp += "\\" + ch;
                    prev_backslash = false;
                } else if (ch == "[") {
                    in_class = true;
                    regexp += ch;
                } else if (ch == "]" && in_class) {
                    in_class = false;
                    regexp += ch;
                } else if (ch == "/" && !in_class) {
                    break;
                } else if (ch == "\\") {
                    prev_backslash = true;
                } else {
                    regexp += ch;
                }
                var mods = read_name();
                try {
                    return token("regexp", new RegExp(regexp, mods));
                } catch (e) {
                    parse_error(e.message);
                }
            });

            function read_operator(prefix) {
                function grow(op) {
                    if (!peek()) return op;
                    var bigger = op + peek();
                    if (OPERATORS(bigger)) {
                        next();
                        return grow(bigger);
                    } else {
                        return op;
                    }
                };
                return token("operator", grow(prefix || next()));
            };

            function handle_slash() {
                next();
                switch (peek()) {
                    case "/":
                        next();
                        return skip_line_comment("comment1");
                    case "*":
                        next();
                        return skip_multiline_comment();
                }
                return S.regex_allowed ? read_regexp("") : read_operator("/");
            };

            function handle_dot() {
                next();
                return is_digit(peek().charCodeAt(0))
                    ? read_num(".")
                    : token("punc", ".");
            };

            function read_word() {
                var word = read_name();
                if (prev_was_dot) return token("name", word);
                return KEYWORDS_ATOM(word) ? token("atom", word)
                    : !KEYWORDS(word) ? token("name", word)
                        : OPERATORS(word) ? token("operator", word)
                            : token("keyword", word);
            };

            function with_eof_error(eof_error, cont) {
                return function (x) {
                    try {
                        return cont(x);
                    } catch (ex) {
                        if (ex === EX_EOF) parse_error(eof_error);
                        else throw ex;
                    }
                };
            };

            function next_token(force_regexp) {
                if (force_regexp != null)
                    return read_regexp(force_regexp);
                skip_whitespace();
                start_token();
                if (html5_comments) {
                    if (looking_at("<!--")) {
                        forward(4);
                        return skip_line_comment("comment3");
                    }
                    if (looking_at("-->") && S.newline_before) {
                        forward(3);
                        return skip_line_comment("comment4");
                    }
                }
                var ch = peek();
                if (!ch) return token("eof");
                var code = ch.charCodeAt(0);
                switch (code) {
                    case 34:
                    case 39:
                        return read_string(ch);
                    case 46:
                        return handle_dot();
                    case 47:
                        return handle_slash();
                }
                if (is_digit(code)) return read_num();
                if (PUNC_CHARS(ch)) return token("punc", next());
                if (OPERATOR_CHARS(ch)) return read_operator();
                if (code == 92 || is_identifier_start(code)) return read_word();

                if (shebang) {
                    if (S.pos == 0 && looking_at("#!")) {
                        forward(2);
                        return skip_line_comment("comment5");
                    }
                }
                parse_error("Unexpected character '" + ch + "'");
            };

            next_token.context = function (nc) {
                if (nc) S = nc;
                return S;
            };

            return next_token;

        };

        /* -----[ Parser (constants) ]----- */

        var UNARY_PREFIX = makePredicate([
            "typeof",
            "void",
            "delete",
            "--",
            "++",
            "!",
            "~",
            "-",
            "+"
        ]);

        var UNARY_POSTFIX = makePredicate(["--", "++"]);

        var ASSIGNMENT = makePredicate(["=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&="]);

        var PRECEDENCE = (function (a, ret) {
            for (var i = 0; i < a.length; ++i) {
                var b = a[i];
                for (var j = 0; j < b.length; ++j) {
                    ret[b[j]] = i + 1;
                }
            }
            return ret;
        })(
            [
                ["||"],
                ["&&"],
                ["|"],
                ["^"],
                ["&"],
                ["==", "===", "!=", "!=="],
                ["<", ">", "<=", ">=", "in", "instanceof"],
                [">>", "<<", ">>>"],
                ["+", "-"],
                ["*", "/", "%"]
            ],
            {}
        );

        var STATEMENTS_WITH_LABELS = array_to_hash(["fo" + "r", "do", "while", "switch"]);

        var ATOMIC_START_TOKEN = array_to_hash(["atom", "num", "string", "regexp", "name"]);

        /* -----[ Parser ]----- */

        function parse($TEXT, options) {

            options = defaults(options, {
                strict: false,
                filename: null,
                toplevel: null,
                expression: false,
                html5_comments: true,
                bare_returns: false,
                shebang: true,
            });

            var S = {
                input: (typeof $TEXT == "string"
                    ? tokenizer($TEXT, options.filename,
                        options.html5_comments, options.shebang)
                    : $TEXT),
                token: null,
                prev: null,
                peeked: null,
                in_function: 0,
                in_directives: true,
                in_loop: 0,
                labels: []
            };

            S.token = next();

            function is(type, value) {
                return is_token(S.token, type, value);
            };

            function peek() {
                return S.peeked || (S.peeked = S.input());
            };

            function next() {
                S.prev = S.token;
                if (S.peeked) {
                    S.token = S.peeked;
                    S.peeked = null;
                } else {
                    S.token = S.input();
                }
                S.in_directives = S.in_directives && (
                    S.token.type == "string" || is("punc", ";")
                );
                return S.token;
            };

            function prev() {
                return S.prev;
            };

            function croak(msg, line, col, pos) {
                var ctx = S.input.context();
                js_error(msg,
                    ctx.filename,
                    line != null ? line : ctx.tokline,
                    col != null ? col : ctx.tokcol,
                    pos != null ? pos : ctx.tokpos);
            };

            function token_error(token, msg) {
                croak(msg, token.line, token.col);
            };

            function unexpected(token) {
                if (token == null)
                    token = S.token;
                token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
            };

            function expect_token(type, val) {
                if (is(type, val)) {
                    return next();
                }
                token_error(S.token, "Unexpected token " + S.token.type + " «" + S.token.value + "»" + ", expected " + type + " «" + val + "»");
            };

            function expect(punc) {
                return expect_token("punc", punc);
            };

            function can_insert_semicolon() {
                return !options.strict && (
                    S.token.nlb || is("eof") || is("punc", "}")
                );
            };

            function semicolon() {
                if (is("punc", ";")) next();
                else if (!can_insert_semicolon()) unexpected();
            };

            function parenthesised() {
                expect("(");
                var exp = expression(true);
                expect(")");
                return exp;
            };

            function embed_tokens(parser) {
                return function () {
                    var start = S.token;
                    var expr = parser();
                    var end = prev();
                    expr.start = start;
                    expr.end = end;
                    return expr;
                };
            };

            function handle_regexp() {
                if (is("operator", "/") || is("operator", "/=")) {
                    S.peeked = null;
                    S.token = S.input(S.token.value.substr(1)); // force regexp
                }
            };

            var statement = embed_tokens(function () {
                var tmp;
                handle_regexp();
                switch (S.token.type) {
                    case "string":
                        var dir = S.in_directives, stat = simple_statement();
                        // XXXv2: decide how to fix directives
                        if (dir && stat.body instanceof AST_String && !is("punc", ",")) {
                            return new AST_Directive({
                                start: stat.body.start,
                                end: stat.body.end,
                                quote: stat.body.quote,
                                value: stat.body.value,
                            });
                        }
                        return stat;
                    case "num":
                    case "regexp":
                    case "operator":
                    case "atom":
                        return simple_statement();

                    case "name":
                        return is_token(peek(), "punc", ":")
                            ? labeled_statement()
                            : simple_statement();

                    case "punc":
                        switch (S.token.value) {
                            case "{":
                                return new AST_BlockStatement({
                                    start: S.token,
                                    body: block_(),
                                    end: prev()
                                });
                            case "[":
                            case "(":
                                return simple_statement();
                            case ";":
                                next();
                                return new AST_EmptyStatement();
                            default:
                                unexpected();
                        }

                    case "keyword":
                        switch (tmp = S.token.value, next(), tmp) {
                            case "break":
                                return break_cont(AST_Break);

                            case "continue":
                                return break_cont(AST_Continue);

                            case "debugger":
                                semicolon();
                                return new AST_Debugger();

                            case "do":
                                return new AST_Do({
                                    body: in_loop(statement),
                                    condition: (expect_token("keyword", "while"), tmp = parenthesised(), semicolon(), tmp)
                                });

                            case "while":
                                return new AST_While({
                                    condition: parenthesised(),
                                    body: in_loop(statement)
                                });

                            case "fo" + "r":
                                return for_();

                            case "function":
                                return function_(AST_Defun);

                            case "if":
                                return if_();

                            case "return":
                                if (S.in_function == 0 && !options.bare_returns)
                                    croak("'return' outside of function");
                                return new AST_Return({
                                    value: (is("punc", ";")
                                        ? (next(), null)
                                        : can_insert_semicolon()
                                            ? null
                                            : (tmp = expression(true), semicolon(), tmp))
                                });

                            case "switch":
                                return new AST_Switch({
                                    expression: parenthesised(),
                                    body: in_loop(switch_body_)
                                });

                            case "throw":
                                if (S.token.nlb)
                                    croak("Illegal newline after 'throw'");
                                return new AST_Throw({
                                    value: (tmp = expression(true), semicolon(), tmp)
                                });

                            case "try":
                                return try_();

                            case "var":
                                return tmp = var_(), semicolon(), tmp;

                            case "const":
                                return tmp = const_(), semicolon(), tmp;

                            case "with":
                                return new AST_With({
                                    expression: parenthesised(),
                                    body: statement()
                                });

                            default:
                                unexpected();
                        }
                }
            });

            function labeled_statement() {
                var label = as_symbol(AST_Label);
                if (find_if(function (l) {
                    return l.name == label.name
                }, S.labels)) {
                    // ECMA-262, 12.12: An ECMAScript program is considered
                    // syntactically incorrect if it contains a
                    // LabelledStatement that is enclosed by a
                    // LabelledStatement with the same Identifier as label.
                    croak("Label " + label.name + " defined twice");
                }
                expect(":");
                S.labels.push(label);
                var stat = statement();
                S.labels.pop();
                if (!(stat instanceof AST_IterationStatement)) {
                    // check for `continue` that refers to this label.
                    // those should be reported as syntax errors.
                    // https://github.com/mishoo/UglifyJS2/issues/287
                    label.references.forEach(function (ref) {
                        if (ref instanceof AST_Continue) {
                            ref = ref.label.start;
                            croak("Continue label `" + label.name + "` refers to non-IterationStatement.",
                                ref.line, ref.col, ref.pos);
                        }
                    });
                }
                return new AST_LabeledStatement({body: stat, label: label});
            };

            function simple_statement(tmp) {
                return new AST_SimpleStatement({body: (tmp = expression(true), semicolon(), tmp)});
            };

            function break_cont(type) {
                var label = null, ldef;
                if (!can_insert_semicolon()) {
                    label = as_symbol(AST_LabelRef, true);
                }
                if (label != null) {
                    ldef = find_if(function (l) {
                        return l.name == label.name
                    }, S.labels);
                    if (!ldef)
                        croak("Undefined label " + label.name);
                    label.thedef = ldef;
                } else if (S.in_loop == 0)
                    croak(type.TYPE + " not inside a loop or switch");
                semicolon();
                var stat = new type({label: label});
                if (ldef) ldef.references.push(stat);
                return stat;
            };

            function for_() {
                expect("(");
                var init = null;
                if (!is("punc", ";")) {
                    init = is("keyword", "var")
                        ? (next(), var_(true))
                        : expression(true, true);
                    if (is("operator", "in")) {
                        if (init instanceof AST_Var && init.definitions.length > 1)
                            croak("Only one variable declaration allowed in for..in loop");
                        next();
                        return for_in(init);
                    }
                }
                return regular_for(init);
            };

            function regular_for(init) {
                expect(";");
                var test = is("punc", ";") ? null : expression(true);
                expect(";");
                var step = is("punc", ")") ? null : expression(true);
                expect(")");
                return new AST_For({
                    init: init,
                    condition: test,
                    step: step,
                    body: in_loop(statement)
                });
            };

            function for_in(init) {
                var lhs = init instanceof AST_Var ? init.definitions[0].name : null;
                var obj = expression(true);
                expect(")");
                return new AST_ForIn({
                    init: init,
                    name: lhs,
                    object: obj,
                    body: in_loop(statement)
                });
            };

            var function_ = function (ctor) {
                var in_statement = ctor === AST_Defun;
                var name = is("name") ? as_symbol(in_statement ? AST_SymbolDefun : AST_SymbolLambda) : null;
                if (in_statement && !name)
                    unexpected();
                expect("(");
                return new ctor({
                    name: name,
                    argnames: (function (first, a) {
                        while (!is("punc", ")")) {
                            if (first) first = false; else expect(",");
                            a.push(as_symbol(AST_SymbolFunarg));
                        }
                        next();
                        return a;
                    })(true, []),
                    body: (function (loop, labels) {
                        ++S.in_function;
                        S.in_directives = true;
                        S.in_loop = 0;
                        S.labels = [];
                        var a = block_();
                        --S.in_function;
                        S.in_loop = loop;
                        S.labels = labels;
                        return a;
                    })(S.in_loop, S.labels)
                });
            };

            function if_() {
                var cond = parenthesised(), body = statement(), belse = null;
                if (is("keyword", "else")) {
                    next();
                    belse = statement();
                }
                return new AST_If({
                    condition: cond,
                    body: body,
                    alternative: belse
                });
            };

            function block_() {
                expect("{");
                var a = [];
                while (!is("punc", "}")) {
                    if (is("eof")) unexpected();
                    a.push(statement());
                }
                next();
                return a;
            };

            function switch_body_() {
                expect("{");
                var a = [], cur = null, branch = null, tmp;
                while (!is("punc", "}")) {
                    if (is("eof")) unexpected();
                    if (is("keyword", "case")) {
                        if (branch) branch.end = prev();
                        cur = [];
                        branch = new AST_Case({
                            start: (tmp = S.token, next(), tmp),
                            expression: expression(true),
                            body: cur
                        });
                        a.push(branch);
                        expect(":");
                    } else if (is("keyword", "default")) {
                        if (branch) branch.end = prev();
                        cur = [];
                        branch = new AST_Default({
                            start: (tmp = S.token, next(), expect(":"), tmp),
                            body: cur
                        });
                        a.push(branch);
                    } else {
                        if (!cur) unexpected();
                        cur.push(statement());
                    }
                }
                if (branch) branch.end = prev();
                next();
                return a;
            };

            function try_() {
                var body = block_(), bcatch = null, bfinally = null;
                if (is("keyword", "catch")) {
                    var start = S.token;
                    next();
                    expect("(");
                    var name = as_symbol(AST_SymbolCatch);
                    expect(")");
                    bcatch = new AST_Catch({
                        start: start,
                        argname: name,
                        body: block_(),
                        end: prev()
                    });
                }
                if (is("keyword", "finally")) {
                    var start = S.token;
                    next();
                    bfinally = new AST_Finally({
                        start: start,
                        body: block_(),
                        end: prev()
                    });
                }
                if (!bcatch && !bfinally)
                    croak("Missing catch/finally blocks");
                return new AST_Try({
                    body: body,
                    bcatch: bcatch,
                    bfinally: bfinally
                });
            };

            function vardefs(no_in, in_const) {
                var a = [];
                for (; ;) {
                    a.push(new AST_VarDef({
                        start: S.token,
                        name: as_symbol(in_const ? AST_SymbolConst : AST_SymbolVar),
                        value: is("operator", "=") ? (next(), expression(false, no_in)) : null,
                        end: prev()
                    }));
                    if (!is("punc", ","))
                        break;
                    next();
                }
                return a;
            };

            var var_ = function (no_in) {
                return new AST_Var({
                    start: prev(),
                    definitions: vardefs(no_in, false),
                    end: prev()
                });
            };

            var const_ = function () {
                return new AST_Const({
                    start: prev(),
                    definitions: vardefs(false, true),
                    end: prev()
                });
            };

            var new_ = function (allow_calls) {
                var start = S.token;
                expect_token("operator", "new");
                var newexp = expr_atom(false), args;
                if (is("punc", "(")) {
                    next();
                    args = expr_list(")");
                } else {
                    args = [];
                }
                return subscripts(new AST_New({
                    start: start,
                    expression: newexp,
                    args: args,
                    end: prev()
                }), allow_calls);
            };

            function as_atom_node() {
                var tok = S.token, ret;
                switch (tok.type) {
                    case "name":
                    case "keyword":
                        ret = _make_symbol(AST_SymbolRef);
                        break;
                    case "num":
                        ret = new AST_Number({start: tok, end: tok, value: tok.value});
                        break;
                    case "string":
                        ret = new AST_String({
                            start: tok,
                            end: tok,
                            value: tok.value,
                            quote: tok.quote
                        });
                        break;
                    case "regexp":
                        ret = new AST_RegExp({start: tok, end: tok, value: tok.value});
                        break;
                    case "atom":
                        switch (tok.value) {
                            case "false":
                                ret = new AST_False({start: tok, end: tok});
                                break;
                            case "true":
                                ret = new AST_True({start: tok, end: tok});
                                break;
                            case "null":
                                ret = new AST_Null({start: tok, end: tok});
                                break;
                        }
                        break;
                }
                next();
                return ret;
            };

            var expr_atom = function (allow_calls) {
                if (is("operator", "new")) {
                    return new_(allow_calls);
                }
                var start = S.token;
                if (is("punc")) {
                    switch (start.value) {
                        case "(":
                            next();
                            var ex = expression(true);
                            ex.start = start;
                            ex.end = S.token;
                            expect(")");
                            return subscripts(ex, allow_calls);
                        case "[":
                            return subscripts(array_(), allow_calls);
                        case "{":
                            return subscripts(object_(), allow_calls);
                    }
                    unexpected();
                }
                if (is("keyword", "function")) {
                    next();
                    var func = function_(AST_Function);
                    func.start = start;
                    func.end = prev();
                    return subscripts(func, allow_calls);
                }
                if (ATOMIC_START_TOKEN[S.token.type]) {
                    return subscripts(as_atom_node(), allow_calls);
                }
                unexpected();
            };

            function expr_list(closing, allow_trailing_comma, allow_empty) {
                var first = true, a = [];
                while (!is("punc", closing)) {
                    if (first) first = false; else expect(",");
                    if (allow_trailing_comma && is("punc", closing)) break;
                    if (is("punc", ",") && allow_empty) {
                        a.push(new AST_Hole({start: S.token, end: S.token}));
                    } else {
                        a.push(expression(false));
                    }
                }
                next();
                return a;
            };

            var array_ = embed_tokens(function () {
                expect("[");
                return new AST_Array({
                    elements: expr_list("]", !options.strict, true)
                });
            });

            var object_ = embed_tokens(function () {
                expect("{");
                var first = true, a = [];
                while (!is("punc", "}")) {
                    if (first) first = false; else expect(",");
                    if (!options.strict && is("punc", "}"))
                    // allow trailing comma
                        break;
                    var start = S.token;
                    var type = start.type;
                    var name = as_property_name();
                    if (type == "name" && !is("punc", ":")) {
                        if (name == "get") {
                            a.push(new AST_ObjectGetter({
                                start: start,
                                key: as_atom_node(),
                                value: function_(AST_Accessor),
                                end: prev()
                            }));
                            continue;
                        }
                        if (name == "set") {
                            a.push(new AST_ObjectSetter({
                                start: start,
                                key: as_atom_node(),
                                value: function_(AST_Accessor),
                                end: prev()
                            }));
                            continue;
                        }
                    }
                    expect(":");
                    a.push(new AST_ObjectKeyVal({
                        start: start,
                        quote: start.quote,
                        key: name,
                        value: expression(false),
                        end: prev()
                    }));
                }
                next();
                return new AST_Object({properties: a});
            });

            function as_property_name() {
                var tmp = S.token;
                next();
                switch (tmp.type) {
                    case "num":
                    case "string":
                    case "name":
                    case "operator":
                    case "keyword":
                    case "atom":
                        return tmp.value;
                    default:
                        unexpected();
                }
            };

            function as_name() {
                var tmp = S.token;
                next();
                switch (tmp.type) {
                    case "name":
                    case "operator":
                    case "keyword":
                    case "atom":
                        return tmp.value;
                    default:
                        unexpected();
                }
            };

            function _make_symbol(type) {
                var name = S.token.value;
                return new (name == "this" ? AST_This : type)({
                    name: String(name),
                    start: S.token,
                    end: S.token
                });
            };

            function as_symbol(type, noerror) {
                if (!is("name")) {
                    if (!noerror) croak("Name expected");
                    return null;
                }
                var sym = _make_symbol(type);
                next();
                return sym;
            };

            var subscripts = function (expr, allow_calls) {
                var start = expr.start;
                if (is("punc", ".")) {
                    next();
                    return subscripts(new AST_Dot({
                        start: start,
                        expression: expr,
                        property: as_name(),
                        end: prev()
                    }), allow_calls);
                }
                if (is("punc", "[")) {
                    next();
                    var prop = expression(true);
                    expect("]");
                    return subscripts(new AST_Sub({
                        start: start,
                        expression: expr,
                        property: prop,
                        end: prev()
                    }), allow_calls);
                }
                if (allow_calls && is("punc", "(")) {
                    next();
                    return subscripts(new AST_Call({
                        start: start,
                        expression: expr,
                        args: expr_list(")"),
                        end: prev()
                    }), true);
                }
                return expr;
            };

            var maybe_unary = function (allow_calls) {
                var start = S.token;
                if (is("operator") && UNARY_PREFIX(start.value)) {
                    next();
                    handle_regexp();
                    var ex = make_unary(AST_UnaryPrefix, start.value, maybe_unary(allow_calls));
                    ex.start = start;
                    ex.end = prev();
                    return ex;
                }
                var val = expr_atom(allow_calls);
                while (is("operator") && UNARY_POSTFIX(S.token.value) && !S.token.nlb) {
                    val = make_unary(AST_UnaryPostfix, S.token.value, val);
                    val.start = start;
                    val.end = S.token;
                    next();
                }
                return val;
            };

            function make_unary(ctor, op, expr) {
                if ((op == "++" || op == "--") && !is_assignable(expr))
                    croak("Invalid use of " + op + " operator");
                return new ctor({operator: op, expression: expr});
            };

            var expr_op = function (left, min_prec, no_in) {
                var op = is("operator") ? S.token.value : null;
                if (op == "in" && no_in) op = null;
                var prec = op != null ? PRECEDENCE[op] : null;
                if (prec != null && prec > min_prec) {
                    next();
                    var right = expr_op(maybe_unary(true), prec, no_in);
                    return expr_op(new AST_Binary({
                        start: left.start,
                        left: left,
                        operator: op,
                        right: right,
                        end: right.end
                    }), min_prec, no_in);
                }
                return left;
            };

            function expr_ops(no_in) {
                return expr_op(maybe_unary(true), 0, no_in);
            };

            var maybe_conditional = function (no_in) {
                var start = S.token;
                var expr = expr_ops(no_in);
                if (is("operator", "?")) {
                    next();
                    var yes = expression(false);
                    expect(":");
                    return new AST_Conditional({
                        start: start,
                        condition: expr,
                        consequent: yes,
                        alternative: expression(false, no_in),
                        end: prev()
                    });
                }
                return expr;
            };

            function is_assignable(expr) {
                if (!options.strict) return true;
                if (expr instanceof AST_This) return false;
                return (expr instanceof AST_PropAccess || expr instanceof AST_Symbol);
            };

            var maybe_assign = function (no_in) {
                var start = S.token;
                var left = maybe_conditional(no_in), val = S.token.value;
                if (is("operator") && ASSIGNMENT(val)) {
                    if (is_assignable(left)) {
                        next();
                        return new AST_Assign({
                            start: start,
                            left: left,
                            operator: val,
                            right: maybe_assign(no_in),
                            end: prev()
                        });
                    }
                    croak("Invalid assignment");
                }
                return left;
            };

            var expression = function (commas, no_in) {
                var start = S.token;
                var expr = maybe_assign(no_in);
                if (commas && is("punc", ",")) {
                    next();
                    return new AST_Seq({
                        start: start,
                        car: expr,
                        cdr: expression(true, no_in),
                        end: peek()
                    });
                }
                return expr;
            };

            function in_loop(cont) {
                ++S.in_loop;
                var ret = cont();
                --S.in_loop;
                return ret;
            };

            if (options.expression) {
                return expression(true);
            }

            return (function () {
                var start = S.token;
                var body = [];
                while (!is("eof"))
                    body.push(statement());
                var end = prev();
                var toplevel = options.toplevel;
                if (toplevel) {
                    toplevel.body = toplevel.body.concat(body);
                    toplevel.end = end;
                } else {
                    toplevel = new AST_Toplevel({start: start, body: body, end: end});
                }
                return toplevel;
            })();

        };

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

// Tree transformer helpers.

        function TreeTransformer(before, after) {
            TreeWalker.call(this);
            this.before = before;
            this.after = after;
        }

        TreeTransformer.prototype = new TreeWalker;

        (function (undefined) {

            function _(node, descend) {
                node.DEFMETHOD("transform", function (tw, in_list) {
                    var x, y;
                    tw.push(this);
                    if (tw.before) x = tw.before(this, descend, in_list);
                    if (x === undefined) {
                        if (!tw.after) {
                            x = this;
                            descend(x, tw);
                        } else {
                            tw.stack[tw.stack.length - 1] = x = this.clone();
                            descend(x, tw);
                            y = tw.after(x, in_list);
                            if (y !== undefined) x = y;
                        }
                    }
                    tw.pop(this);
                    return x;
                });
            };

            function do_list(list, tw) {
                return MAP(list, function (node) {
                    return node.transform(tw, true);
                });
            };

            _(AST_Node, noop);

            _(AST_LabeledStatement, function (self, tw) {
                self.label = self.label.transform(tw);
                self.body = self.body.transform(tw);
            });

            _(AST_SimpleStatement, function (self, tw) {
                self.body = self.body.transform(tw);
            });

            _(AST_Block, function (self, tw) {
                self.body = do_list(self.body, tw);
            });

            _(AST_DWLoop, function (self, tw) {
                self.condition = self.condition.transform(tw);
                self.body = self.body.transform(tw);
            });

            _(AST_For, function (self, tw) {
                if (self.init) self.init = self.init.transform(tw);
                if (self.condition) self.condition = self.condition.transform(tw);
                if (self.step) self.step = self.step.transform(tw);
                self.body = self.body.transform(tw);
            });

            _(AST_ForIn, function (self, tw) {
                self.init = self.init.transform(tw);
                self.object = self.object.transform(tw);
                self.body = self.body.transform(tw);
            });

            _(AST_With, function (self, tw) {
                self.expression = self.expression.transform(tw);
                self.body = self.body.transform(tw);
            });

            _(AST_Exit, function (self, tw) {
                if (self.value) self.value = self.value.transform(tw);
            });

            _(AST_LoopControl, function (self, tw) {
                if (self.label) self.label = self.label.transform(tw);
            });

            _(AST_If, function (self, tw) {
                self.condition = self.condition.transform(tw);
                self.body = self.body.transform(tw);
                if (self.alternative) self.alternative = self.alternative.transform(tw);
            });

            _(AST_Switch, function (self, tw) {
                self.expression = self.expression.transform(tw);
                self.body = do_list(self.body, tw);
            });

            _(AST_Case, function (self, tw) {
                self.expression = self.expression.transform(tw);
                self.body = do_list(self.body, tw);
            });

            _(AST_Try, function (self, tw) {
                self.body = do_list(self.body, tw);
                if (self.bcatch) self.bcatch = self.bcatch.transform(tw);
                if (self.bfinally) self.bfinally = self.bfinally.transform(tw);
            });

            _(AST_Catch, function (self, tw) {
                self.argname = self.argname.transform(tw);
                self.body = do_list(self.body, tw);
            });

            _(AST_Definitions, function (self, tw) {
                self.definitions = do_list(self.definitions, tw);
            });

            _(AST_VarDef, function (self, tw) {
                self.name = self.name.transform(tw);
                if (self.value) self.value = self.value.transform(tw);
            });

            _(AST_Lambda, function (self, tw) {
                if (self.name) self.name = self.name.transform(tw);
                self.argnames = do_list(self.argnames, tw);
                self.body = do_list(self.body, tw);
            });

            _(AST_Call, function (self, tw) {
                self.expression = self.expression.transform(tw);
                self.args = do_list(self.args, tw);
            });

            _(AST_Seq, function (self, tw) {
                self.car = self.car.transform(tw);
                self.cdr = self.cdr.transform(tw);
            });

            _(AST_Dot, function (self, tw) {
                self.expression = self.expression.transform(tw);
            });

            _(AST_Sub, function (self, tw) {
                self.expression = self.expression.transform(tw);
                self.property = self.property.transform(tw);
            });

            _(AST_Unary, function (self, tw) {
                self.expression = self.expression.transform(tw);
            });

            _(AST_Binary, function (self, tw) {
                self.left = self.left.transform(tw);
                self.right = self.right.transform(tw);
            });

            _(AST_Conditional, function (self, tw) {
                self.condition = self.condition.transform(tw);
                self.consequent = self.consequent.transform(tw);
                self.alternative = self.alternative.transform(tw);
            });

            _(AST_Array, function (self, tw) {
                self.elements = do_list(self.elements, tw);
            });

            _(AST_Object, function (self, tw) {
                self.properties = do_list(self.properties, tw);
            });

            _(AST_ObjectProperty, function (self, tw) {
                self.value = self.value.transform(tw);
            });

        })();

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function SymbolDef(scope, index, orig) {
            this.name = orig.name;
            this.orig = [orig];
            this.scope = scope;
            this.references = [];
            this.global = false;
            this.mangled_name = null;
            this.undeclared = false;
            this.constant = false;
            this.index = index;
        };

        SymbolDef.prototype = {
            unmangleable: function (options) {
                if (!options) options = {};

                return (this.global && !options.toplevel)
                    || this.undeclared
                    || (!options.eval && (this.scope.uses_eval || this.scope.uses_with))
                    || (options.keep_fnames
                        && (this.orig[0] instanceof AST_SymbolLambda
                            || this.orig[0] instanceof AST_SymbolDefun));
            },
            mangle: function (options) {
                var cache = options.cache && options.cache.props;
                if (this.global && cache && cache.has(this.name)) {
                    this.mangled_name = cache.get(this.name);
                } else if (!this.mangled_name && !this.unmangleable(options)) {
                    var s = this.scope;
                    if (!options.screw_ie8 && this.orig[0] instanceof AST_SymbolLambda)
                        s = s.parent_scope;
                    this.mangled_name = s.next_mangled(options, this);
                    if (this.global && cache) {
                        cache.set(this.name, this.mangled_name);
                    }
                }
            }
        };

        AST_Toplevel.DEFMETHOD("figure_out_scope", function (options) {
            options = defaults(options, {
                screw_ie8: false,
                cache: null
            });

            // pass 1: setup scope chaining and handle definitions
            var self = this;
            var scope = self.parent_scope = null;
            var labels = new Dictionary();
            var defun = null;
            var nesting = 0;
            var tw = new TreeWalker(function (node, descend) {
                if (options.screw_ie8 && node instanceof AST_Catch) {
                    var save_scope = scope;
                    scope = new AST_Scope(node);
                    scope.init_scope_vars(nesting);
                    scope.parent_scope = save_scope;
                    descend();
                    scope = save_scope;
                    return true;
                }
                if (node instanceof AST_Scope) {
                    node.init_scope_vars(nesting);
                    var save_scope = node.parent_scope = scope;
                    var save_defun = defun;
                    var save_labels = labels;
                    defun = scope = node;
                    labels = new Dictionary();
                    ++nesting;
                    descend();
                    --nesting;
                    scope = save_scope;
                    defun = save_defun;
                    labels = save_labels;
                    return true;        // don't descend again in TreeWalker
                }
                if (node instanceof AST_LabeledStatement) {
                    var l = node.label;
                    if (labels.has(l.name)) {
                        throw new Error(string_template("Label {name} defined twice", l));
                    }
                    labels.set(l.name, l);
                    descend();
                    labels.del(l.name);
                    return true;        // no descend again
                }
                if (node instanceof AST_With) {
                    for (var s = scope; s; s = s.parent_scope)
                        s.uses_with = true;
                    return;
                }
                if (node instanceof AST_Symbol) {
                    node.scope = scope;
                }
                if (node instanceof AST_Label) {
                    node.thedef = node;
                    node.references = [];
                }
                if (node instanceof AST_SymbolLambda) {
                    defun.def_function(node);
                } else if (node instanceof AST_SymbolDefun) {
                    // Careful here, the scope where this should be defined is
                    // the parent scope.  The reason is that we enter a new
                    // scope when we encounter the AST_Defun node (which is
                    // instanceof AST_Scope) but we get to the symbol a bit
                    // later.
                    (node.scope = defun.parent_scope).def_function(node);
                } else if (node instanceof AST_SymbolVar
                    || node instanceof AST_SymbolConst) {
                    var def = defun.def_variable(node);
                    def.constant = node instanceof AST_SymbolConst;
                    def.init = tw.parent().value;
                } else if (node instanceof AST_SymbolCatch) {
                    (options.screw_ie8 ? scope : defun)
                        .def_variable(node);
                } else if (node instanceof AST_LabelRef) {
                    var sym = labels.get(node.name);
                    if (!sym) throw new Error(string_template("Undefined label {name} [{line},{col}]", {
                        name: node.name,
                        line: node.start.line,
                        col: node.start.col
                    }));
                    node.thedef = sym;
                }
            });
            self.walk(tw);

            // pass 2: find back references and eval
            var func = null;
            var globals = self.globals = new Dictionary();
            var tw = new TreeWalker(function (node, descend) {
                if (node instanceof AST_Lambda) {
                    var prev_func = func;
                    func = node;
                    descend();
                    func = prev_func;
                    return true;
                }
                if (node instanceof AST_LoopControl && node.label) {
                    node.label.thedef.references.push(node);
                    return true;
                }
                if (node instanceof AST_SymbolRef) {
                    var name = node.name;
                    var sym = node.scope.find_variable(name);
                    if (!sym) {
                        var g;
                        if (globals.has(name)) {
                            g = globals.get(name);
                        } else {
                            g = new SymbolDef(self, globals.size(), node);
                            g.undeclared = true;
                            g.global = true;
                            globals.set(name, g);
                        }
                        node.thedef = g;
                        if (name == "eval" && tw.parent() instanceof AST_Call) {
                            for (var s = node.scope; s && !s.uses_eval; s = s.parent_scope)
                                s.uses_eval = true;
                        }
                        if (func && name == "arguments") {
                            func.uses_arguments = true;
                        }
                    } else {
                        node.thedef = sym;
                    }
                    node.reference();
                    return true;
                }
            });
            self.walk(tw);

            if (options.cache) {
                this.cname = options.cache.cname;
            }
        });

        AST_Scope.DEFMETHOD("init_scope_vars", function (nesting) {
            this.variables = new Dictionary(); // map name to AST_SymbolVar (variables defined in this scope; includes functions)
            this.functions = new Dictionary(); // map name to AST_SymbolDefun (functions defined in this scope)
            this.uses_with = false;   // will be set to true if this or some nested scope uses the `with` statement
            this.uses_eval = false;   // will be set to true if this or nested scope uses the global `eval`
            this.parent_scope = null; // the parent scope
            this.enclosed = [];       // a list of variables from this or outer scope(s) that are referenced from this or inner scopes
            this.cname = -1;          // the current index for mangling functions/variables
            this.nesting = nesting;   // the nesting level of this scope (0 means toplevel)
        });

        AST_Lambda.DEFMETHOD("init_scope_vars", function () {
            AST_Scope.prototype.init_scope_vars.apply(this, arguments);
            this.uses_arguments = false;
        });

        AST_SymbolRef.DEFMETHOD("reference", function () {
            var def = this.definition();
            def.references.push(this);
            var s = this.scope;
            while (s) {
                push_uniq(s.enclosed, def);
                if (s === def.scope) break;
                s = s.parent_scope;
            }
            this.frame = this.scope.nesting - def.scope.nesting;
        });

        AST_Scope.DEFMETHOD("find_variable", function (name) {
            if (name instanceof AST_Symbol) name = name.name;
            return this.variables.get(name)
                || (this.parent_scope && this.parent_scope.find_variable(name));
        });

        AST_Scope.DEFMETHOD("def_function", function (symbol) {
            this.functions.set(symbol.name, this.def_variable(symbol));
        });

        AST_Scope.DEFMETHOD("def_variable", function (symbol) {
            var def;
            if (!this.variables.has(symbol.name)) {
                def = new SymbolDef(this, this.variables.size(), symbol);
                this.variables.set(symbol.name, def);
                def.global = !this.parent_scope;
            } else {
                def = this.variables.get(symbol.name);
                def.orig.push(symbol);
            }
            return symbol.thedef = def;
        });

        AST_Scope.DEFMETHOD("next_mangled", function (options) {
            var ext = this.enclosed;
            out: while (true) {
                var m = base54(++this.cname);
                if (!is_identifier(m)) continue; // skip over "do"

                // https://github.com/mishoo/UglifyJS2/issues/242 -- do not
                // shadow a name excepted from mangling.
                if (options.except.indexOf(m) >= 0) continue;

                // we must ensure that the mangled name does not shadow a name
                // from some parent scope that is referenced in this or in
                // inner scopes.
                for (var i = ext.length; --i >= 0;) {
                    var sym = ext[i];
                    var name = sym.mangled_name || (sym.unmangleable(options) && sym.name);
                    if (m == name) continue out;
                }
                return m;
            }
        });

        AST_Function.DEFMETHOD("next_mangled", function (options, def) {
            // #179, #326
            // in Safari strict mode, something like (function x(x){...}) is a syntax error;
            // a function expression's argument cannot shadow the function expression's name

            var tricky_def = def.orig[0] instanceof AST_SymbolFunarg && this.name && this.name.definition();
            while (true) {
                var name = AST_Lambda.prototype.next_mangled.call(this, options, def);
                if (!(tricky_def && tricky_def.mangled_name == name))
                    return name;
            }
        });

        AST_Scope.DEFMETHOD("references", function (sym) {
            if (sym instanceof AST_Symbol) sym = sym.definition();
            return this.enclosed.indexOf(sym) < 0 ? null : sym;
        });

        AST_Symbol.DEFMETHOD("unmangleable", function (options) {
            return this.definition().unmangleable(options);
        });

// property accessors are not mangleable
        AST_SymbolAccessor.DEFMETHOD("unmangleable", function () {
            return true;
        });

// labels are always mangleable
        AST_Label.DEFMETHOD("unmangleable", function () {
            return false;
        });

        AST_Symbol.DEFMETHOD("unreferenced", function () {
            return this.definition().references.length == 0
                && !(this.scope.uses_eval || this.scope.uses_with);
        });

        AST_Symbol.DEFMETHOD("undeclared", function () {
            return this.definition().undeclared;
        });

        AST_LabelRef.DEFMETHOD("undeclared", function () {
            return false;
        });

        AST_Label.DEFMETHOD("undeclared", function () {
            return false;
        });

        AST_Symbol.DEFMETHOD("definition", function () {
            return this.thedef;
        });

        AST_Symbol.DEFMETHOD("global", function () {
            return this.definition().global;
        });

        AST_Toplevel.DEFMETHOD("_default_mangler_options", function (options) {
            return defaults(options, {
                except: [],
                eval: false,
                sort: false,
                toplevel: false,
                screw_ie8: false,
                keep_fnames: false
            });
        });

        AST_Toplevel.DEFMETHOD("mangle_names", function (options) {
            options = this._default_mangler_options(options);
            // We only need to mangle declaration nodes.  Special logic wired
            // into the code generator will display the mangled name if it's
            // present (and for AST_SymbolRef-s it'll use the mangled name of
            // the AST_SymbolDeclaration that it points to).
            var lname = -1;
            var to_mangle = [];

            if (options.cache) {
                this.globals.each(function (symbol) {
                    if (options.except.indexOf(symbol.name) < 0) {
                        to_mangle.push(symbol);
                    }
                });
            }

            var tw = new TreeWalker(function (node, descend) {
                if (node instanceof AST_LabeledStatement) {
                    // lname is incremented when we get to the AST_Label
                    var save_nesting = lname;
                    descend();
                    lname = save_nesting;
                    return true;        // don't descend again in TreeWalker
                }
                if (node instanceof AST_Scope) {
                    var p = tw.parent(), a = [];
                    node.variables.each(function (symbol) {
                        if (options.except.indexOf(symbol.name) < 0) {
                            a.push(symbol);
                        }
                    });
                    if (options.sort) a.sort(function (a, b) {
                        return b.references.length - a.references.length;
                    });
                    to_mangle.push.apply(to_mangle, a);
                    return;
                }
                if (node instanceof AST_Label) {
                    var name;
                    do name = base54(++lname); while (!is_identifier(name));
                    node.mangled_name = name;
                    return true;
                }
                if (options.screw_ie8 && node instanceof AST_SymbolCatch) {
                    to_mangle.push(node.definition());
                    return;
                }
            });
            this.walk(tw);
            to_mangle.forEach(function (def) {
                def.mangle(options)
            });

            if (options.cache) {
                options.cache.cname = this.cname;
            }
        });

        AST_Toplevel.DEFMETHOD("compute_char_frequency", function (options) {
            options = this._default_mangler_options(options);
            var tw = new TreeWalker(function (node) {
                if (node instanceof AST_Constant)
                    base54.consider(node.print_to_string());
                else if (node instanceof AST_Return)
                    base54.consider("return");
                else if (node instanceof AST_Throw)
                    base54.consider("throw");
                else if (node instanceof AST_Continue)
                    base54.consider("continue");
                else if (node instanceof AST_Break)
                    base54.consider("break");
                else if (node instanceof AST_Debugger)
                    base54.consider("debugger");
                else if (node instanceof AST_Directive)
                    base54.consider(node.value);
                else if (node instanceof AST_While)
                    base54.consider("while");
                else if (node instanceof AST_Do)
                    base54.consider("do while");
                else if (node instanceof AST_If) {
                    base54.consider("if");
                    if (node.alternative) base54.consider("else");
                } else if (node instanceof AST_Var)
                    base54.consider("var");
                else if (node instanceof AST_Const)
                    base54.consider("const");
                else if (node instanceof AST_Lambda)
                    base54.consider("function");
                else if (node instanceof AST_For)
                    base54.consider("fo" + "r");
                else if (node instanceof AST_ForIn)
                    base54.consider("for in");
                else if (node instanceof AST_Switch)
                    base54.consider("switch");
                else if (node instanceof AST_Case)
                    base54.consider("case");
                else if (node instanceof AST_Default)
                    base54.consider("default");
                else if (node instanceof AST_With)
                    base54.consider("with");
                else if (node instanceof AST_ObjectSetter)
                    base54.consider("set" + node.key);
                else if (node instanceof AST_ObjectGetter)
                    base54.consider("get" + node.key);
                else if (node instanceof AST_ObjectKeyVal)
                    base54.consider(node.key);
                else if (node instanceof AST_New)
                    base54.consider("new");
                else if (node instanceof AST_This)
                    base54.consider("this");
                else if (node instanceof AST_Try)
                    base54.consider("try");
                else if (node instanceof AST_Catch)
                    base54.consider("catch");
                else if (node instanceof AST_Finally)
                    base54.consider("finally");
                else if (node instanceof AST_Symbol && node.unmangleable(options))
                    base54.consider(node.name);
                else if (node instanceof AST_Unary || node instanceof AST_Binary)
                    base54.consider(node.operator);
                else if (node instanceof AST_Dot)
                    base54.consider(node.property);
            });
            this.walk(tw);
            base54.sort();
        });

        var base54 = (function () {
            var string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_0123456789";
            var chars, frequency;

            function reset() {
                frequency = Object.create(null);
                chars = string.split("").map(function (ch) {
                    return ch.charCodeAt(0)
                });
                chars.forEach(function (ch) {
                    frequency[ch] = 0
                });
            }

            base54.consider = function (str) {
                for (var i = str.length; --i >= 0;) {
                    var code = str.charCodeAt(i);
                    if (code in frequency) ++frequency[code];
                }
            };
            base54.sort = function () {
                chars = mergeSort(chars, function (a, b) {
                    if (is_digit(a) && !is_digit(b)) return 1;
                    if (is_digit(b) && !is_digit(a)) return -1;
                    return frequency[b] - frequency[a];
                });
            };
            base54.reset = reset;
            reset();
            base54.get = function () {
                return chars
            };
            base54.freq = function () {
                return frequency
            };

            function base54(num) {
                var ret = "", base = 54;
                num++;
                do {
                    num--;
                    ret += String.fromCharCode(chars[num % base]);
                    num = Math.floor(num / base);
                    base = 64;
                } while (num > 0);
                return ret;
            };
            return base54;
        })();

        AST_Toplevel.DEFMETHOD("scope_warnings", function (options) {
            options = defaults(options, {
                undeclared: false, // this makes a lot of noise
                unreferenced: true,
                assign_to_global: true,
                func_arguments: true,
                nested_defuns: true,
                eval: true
            });
            var tw = new TreeWalker(function (node) {
                if (options.undeclared
                    && node instanceof AST_SymbolRef
                    && node.undeclared()) {
                    // XXX: this also warns about JS standard names,
                    // i.e. Object, Array, parseInt etc.  Should add a list of
                    // exceptions.
                    AST_Node.warn("Undeclared symbol: {name} [{file}:{line},{col}]", {
                        name: node.name,
                        file: node.start.file,
                        line: node.start.line,
                        col: node.start.col
                    });
                }
                if (options.assign_to_global) {
                    var sym = null;
                    if (node instanceof AST_Assign && node.left instanceof AST_SymbolRef)
                        sym = node.left;
                    else if (node instanceof AST_ForIn && node.init instanceof AST_SymbolRef)
                        sym = node.init;
                    if (sym
                        && (sym.undeclared()
                            || (sym.global() && sym.scope !== sym.definition().scope))) {
                        AST_Node.warn("{msg}: {name} [{file}:{line},{col}]", {
                            msg: sym.undeclared() ? "Accidental global?" : "Assignment to global",
                            name: sym.name,
                            file: sym.start.file,
                            line: sym.start.line,
                            col: sym.start.col
                        });
                    }
                }
                if (options.eval
                    && node instanceof AST_SymbolRef
                    && node.undeclared()
                    && node.name == "eval") {
                    AST_Node.warn("Eval is used [{file}:{line},{col}]", node.start);
                }
                if (options.unreferenced
                    && (node instanceof AST_SymbolDeclaration || node instanceof AST_Label)
                    && !(node instanceof AST_SymbolCatch)
                    && node.unreferenced()) {
                    AST_Node.warn("{type} {name} is declared but not referenced [{file}:{line},{col}]", {
                        type: node instanceof AST_Label ? "Label" : "Symbol",
                        name: node.name,
                        file: node.start.file,
                        line: node.start.line,
                        col: node.start.col
                    });
                }
                if (options.func_arguments
                    && node instanceof AST_Lambda
                    && node.uses_arguments) {
                    AST_Node.warn("arguments used in function {name} [{file}:{line},{col}]", {
                        name: node.name ? node.name.name : "anonymous",
                        file: node.start.file,
                        line: node.start.line,
                        col: node.start.col
                    });
                }
                if (options.nested_defuns
                    && node instanceof AST_Defun
                    && !(tw.parent() instanceof AST_Scope)) {
                    AST_Node.warn("Function {name} declared in nested statement \"{type}\" [{file}:{line},{col}]", {
                        name: node.name.name,
                        type: tw.parent().TYPE,
                        file: node.start.file,
                        line: node.start.line,
                        col: node.start.col
                    });
                }
            });
            this.walk(tw);
        });

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function OutputStream(options) {

            options = defaults(options, {
                indent_start: 0,
                indent_level: 4,
                quote_keys: false,
                space_colon: true,
                ascii_only: false,
                unescape_regexps: false,
                inline_script: false,
                width: 80,
                max_line_len: 32000,
                beautify: false,
                source_map: null,
                bracketize: false,
                semicolons: true,
                comments: false,
                shebang: true,
                preserve_line: false,
                screw_ie8: false,
                preamble: null,
                quote_style: 0
            }, true);

            var indentation = 0;
            var current_col = 0;
            var current_line = 1;
            var current_pos = 0;
            var OUTPUT = "";

            function to_ascii(str, identifier) {
                return str.replace(/[\u0080-\uffff]/g, function (ch) {
                    var code = ch.charCodeAt(0).toString(16);
                    if (code.length <= 2 && !identifier) {
                        while (code.length < 2) code = "0" + code;
                        return "\\x" + code;
                    } else {
                        while (code.length < 4) code = "0" + code;
                        return "\\u" + code;
                    }
                });
            };

            function make_string(str, quote) {
                var dq = 0, sq = 0;
                str = str.replace(/[\\\b\f\n\r\v\t\x22\x27\u2028\u2029\0\ufeff]/g, function (s) {
                    switch (s) {
                        case "\\":
                            return "\\\\";
                        case "\b":
                            return "\\b";
                        case "\f":
                            return "\\f";
                        case "\n":
                            return "\\n";
                        case "\r":
                            return "\\r";
                        case "\x0B":
                            return options.screw_ie8 ? "\\v" : "\\x0B";
                        case "\u2028":
                            return "\\u2028";
                        case "\u2029":
                            return "\\u2029";
                        case '"':
                            ++dq;
                            return '"';
                        case "'":
                            ++sq;
                            return "'";
                        case "\0":
                            return "\\x00";
                        case "\ufeff":
                            return "\\ufeff";
                    }
                    return s;
                });

                function quote_single() {
                    return "'" + str.replace(/\x27/g, "\\'") + "'";
                }

                function quote_double() {
                    return '"' + str.replace(/\x22/g, '\\"') + '"';
                }

                if (options.ascii_only) str = to_ascii(str);
                switch (options.quote_style) {
                    case 1:
                        return quote_single();
                    case 2:
                        return quote_double();
                    case 3:
                        return quote == "'" ? quote_single() : quote_double();
                    default:
                        return dq > sq ? quote_single() : quote_double();
                }
            };

            function encode_string(str, quote) {
                var ret = make_string(str, quote);
                if (options.inline_script) {
                    ret = ret.replace(/<\x2fscript([>\/\t\n\f\r ])/gi, "<\\/script$1");
                    ret = ret.replace(/\x3c!--/g, "\\x3c!--");
                    ret = ret.replace(/--\x3e/g, "--\\x3e");
                }
                return ret;
            };

            function make_name(name) {
                name = name.toString();
                if (options.ascii_only)
                    name = to_ascii(name, true);
                return name;
            };

            function make_indent(back) {
                return repeat_string(" ", options.indent_start + indentation - back * options.indent_level);
            };

            /* -----[ beautification/minification ]----- */

            var might_need_space = false;
            var might_need_semicolon = false;
            var last = null;

            function last_char() {
                return last.charAt(last.length - 1);
            };

            function maybe_newline() {
                if (options.max_line_len && current_col > options.max_line_len)
                    print("\n");
            };

            var requireSemicolonChars = makePredicate("( [ + * / - , .");

            function print(str) {
                str = String(str);
                var ch = str.charAt(0);
                if (might_need_semicolon) {
                    might_need_semicolon = false;

                    if ((!ch || ";}".indexOf(ch) < 0) && !/[;]$/.test(last)) {
                        if (options.semicolons || requireSemicolonChars(ch)) {
                            OUTPUT += ";";
                            current_col++;
                            current_pos++;
                        } else {
                            OUTPUT += "\n";
                            current_pos++;
                            current_line++;
                            current_col = 0;

                            if (/^\s+$/.test(str)) {
                                // reset the semicolon flag, since we didn't print one
                                // now and might still have to later
                                might_need_semicolon = true;
                            }
                        }

                        if (!options.beautify)
                            might_need_space = false;
                    }
                }

                if (!options.beautify && options.preserve_line && stack[stack.length - 1]) {
                    var target_line = stack[stack.length - 1].start.line;
                    while (current_line < target_line) {
                        OUTPUT += "\n";
                        current_pos++;
                        current_line++;
                        current_col = 0;
                        might_need_space = false;
                    }
                }

                if (might_need_space) {
                    var prev = last_char();
                    if ((is_identifier_char(prev)
                        && (is_identifier_char(ch) || ch == "\\"))
                        || (/^[\+\-\/]$/.test(ch) && ch == prev)) {
                        OUTPUT += " ";
                        current_col++;
                        current_pos++;
                    }
                    might_need_space = false;
                }
                var a = str.split(/\r?\n/), n = a.length - 1;
                current_line += n;
                if (n == 0) {
                    current_col += a[n].length;
                } else {
                    current_col = a[n].length;
                }
                current_pos += str.length;
                last = str;
                OUTPUT += str;
            };

            var space = options.beautify ? function () {
                print(" ");
            } : function () {
                might_need_space = true;
            };

            var indent = options.beautify ? function (half) {
                if (options.beautify) {
                    print(make_indent(half ? 0.5 : 0));
                }
            } : noop;

            var with_indent = options.beautify ? function (col, cont) {
                if (col === true) col = next_indent();
                var save_indentation = indentation;
                indentation = col;
                var ret = cont();
                indentation = save_indentation;
                return ret;
            } : function (col, cont) {
                return cont()
            };

            var newline = options.beautify ? function () {
                print("\n");
            } : maybe_newline;

            var semicolon = options.beautify ? function () {
                print(";");
            } : function () {
                might_need_semicolon = true;
            };

            function force_semicolon() {
                might_need_semicolon = false;
                print(";");
            };

            function next_indent() {
                return indentation + options.indent_level;
            };

            function with_block(cont) {
                var ret;
                print("{");
                newline();
                with_indent(next_indent(), function () {
                    ret = cont();
                });
                indent();
                print("}");
                return ret;
            };

            function with_parens(cont) {
                print("(");
                //XXX: still nice to have that for argument lists
                //var ret = with_indent(current_col, cont);
                var ret = cont();
                print(")");
                return ret;
            };

            function with_square(cont) {
                print("[");
                //var ret = with_indent(current_col, cont);
                var ret = cont();
                print("]");
                return ret;
            };

            function comma() {
                print(",");
                space();
            };

            function colon() {
                print(":");
                if (options.space_colon) space();
            };

            var add_mapping = options.source_map ? function (token, name) {
                try {
                    if (token) options.source_map.add(
                        token.file || "?",
                        current_line, current_col,
                        token.line, token.col,
                        (!name && token.type == "name") ? token.value : name
                    );
                } catch (ex) {
                    AST_Node.warn("Couldn't figure out mapping for {file}:{line},{col} → {cline},{ccol} [{name}]", {
                        file: token.file,
                        line: token.line,
                        col: token.col,
                        cline: current_line,
                        ccol: current_col,
                        name: name || ""
                    })
                }
            } : noop;

            function get() {
                return OUTPUT;
            };

            if (options.preamble) {
                print(options.preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, "\n"));
            }

            var stack = [];
            return {
                get: get,
                toString: get,
                indent: indent,
                indentation: function () {
                    return indentation
                },
                current_width: function () {
                    return current_col - indentation
                },
                should_break: function () {
                    return options.width && this.current_width() >= options.width
                },
                newline: newline,
                print: print,
                space: space,
                comma: comma,
                colon: colon,
                last: function () {
                    return last
                },
                semicolon: semicolon,
                force_semicolon: force_semicolon,
                to_ascii: to_ascii,
                print_name: function (name) {
                    print(make_name(name))
                },
                print_string: function (str, quote) {
                    print(encode_string(str, quote))
                },
                next_indent: next_indent,
                with_indent: with_indent,
                with_block: with_block,
                with_parens: with_parens,
                with_square: with_square,
                add_mapping: add_mapping,
                option: function (opt) {
                    return options[opt]
                },
                line: function () {
                    return current_line
                },
                col: function () {
                    return current_col
                },
                pos: function () {
                    return current_pos
                },
                push_node: function (node) {
                    stack.push(node)
                },
                pop_node: function () {
                    return stack.pop()
                },
                stack: function () {
                    return stack
                },
                parent: function (n) {
                    return stack[stack.length - 2 - (n || 0)];
                }
            };

        };

        /* -----[ code generators ]----- */

        (function () {

            /* -----[ utils ]----- */

            function DEFPRINT(nodetype, generator) {
                nodetype.DEFMETHOD("_codegen", generator);
            };

            var use_asm = false;

            AST_Node.DEFMETHOD("print", function (stream, force_parens) {
                var self = this, generator = self._codegen, prev_use_asm = use_asm;
                if (self instanceof AST_Directive && self.value == "use asm") {
                    use_asm = true;
                }

                function doit() {
                    self.add_comments(stream);
                    self.add_source_map(stream);
                    generator(self, stream);
                }

                stream.push_node(self);
                if (force_parens || self.needs_parens(stream)) {
                    stream.with_parens(doit);
                } else {
                    doit();
                }
                stream.pop_node();
                if (self instanceof AST_Lambda) {
                    use_asm = prev_use_asm;
                }
            });

            AST_Node.DEFMETHOD("print_to_string", function (options) {
                var s = OutputStream(options);
                this.print(s);
                return s.get();
            });

            /* -----[ comments ]----- */

            AST_Node.DEFMETHOD("add_comments", function (output) {
                var c = output.option("comments"), self = this;
                var start = self.start;
                if (start && !start._comments_dumped) {
                    start._comments_dumped = true;
                    var comments = start.comments_before || [];

                    // XXX: ugly fix for https://github.com/mishoo/UglifyJS2/issues/112
                    //               and https://github.com/mishoo/UglifyJS2/issues/372
                    if (self instanceof AST_Exit && self.value) {
                        self.value.walk(new TreeWalker(function (node) {
                            if (node.start && node.start.comments_before) {
                                comments = comments.concat(node.start.comments_before);
                                node.start.comments_before = [];
                            }
                            if (node instanceof AST_Function ||
                                node instanceof AST_Array ||
                                node instanceof AST_Object) {
                                return true; // don't go inside.
                            }
                        }));
                    }

                    if (!c) {
                        comments = comments.filter(function (comment) {
                            return comment.type == "comment5";
                        });
                    } else if (c.test) {
                        comments = comments.filter(function (comment) {
                            return c.test(comment.value) || comment.type == "comment5";
                        });
                    } else if (typeof c == "function") {
                        comments = comments.filter(function (comment) {
                            return c(self, comment) || comment.type == "comment5";
                        });
                    }

                    // Keep single line comments after nlb, after nlb
                    if (!output.option("beautify") && comments.length > 0 &&
                        /comment[134]/.test(comments[0].type) &&
                        output.col() !== 0 && comments[0].nlb) {
                        output.print("\n");
                    }

                    comments.forEach(function (c) {
                        if (/comment[134]/.test(c.type)) {
                            output.print("//" + c.value + "\n");
                            output.indent();
                        } else if (c.type == "comment2") {
                            output.print("/*" + c.value + "*/");
                            if (start.nlb) {
                                output.print("\n");
                                output.indent();
                            } else {
                                output.space();
                            }
                        } else if (output.pos() === 0 && c.type == "comment5" && output.option("shebang")) {
                            output.print("#!" + c.value + "\n");
                            output.indent();
                        }
                    });
                }
            });

            /* -----[ PARENTHESES ]----- */

            function PARENS(nodetype, func) {
                if (Array.isArray(nodetype)) {
                    nodetype.forEach(function (nodetype) {
                        PARENS(nodetype, func);
                    });
                } else {
                    nodetype.DEFMETHOD("needs_parens", func);
                }
            };

            PARENS(AST_Node, function () {
                return false;
            });

            // a function expression needs parens around it when it's provably
            // the first token to appear in a statement.
            PARENS(AST_Function, function (output) {
                return first_in_statement(output);
            });

            // same goes for an object literal, because otherwise it would be
            // interpreted as a block of code.
            PARENS(AST_Object, function (output) {
                return first_in_statement(output);
            });

            PARENS([AST_Unary, AST_Undefined], function (output) {
                var p = output.parent();
                return p instanceof AST_PropAccess && p.expression === this;
            });

            PARENS(AST_Seq, function (output) {
                var p = output.parent();
                return p instanceof AST_Call             // (foo, bar)() or foo(1, (2, 3), 4)
                    || p instanceof AST_Unary            // !(foo, bar, baz)
                    || p instanceof AST_Binary           // 1 + (2, 3) + 4 ==> 8
                    || p instanceof AST_VarDef           // var a = (1, 2), b = a + a; ==> b == 4
                    || p instanceof AST_PropAccess       // (1, {foo:2}).foo or (1, {foo:2})["foo"] ==> 2
                    || p instanceof AST_Array            // [ 1, (2, 3), 4 ] ==> [ 1, 3, 4 ]
                    || p instanceof AST_ObjectProperty   // { foo: (1, 2) }.foo ==> 2
                    || p instanceof AST_Conditional      /* (false, true) ? (a = 10, b = 20) : (c = 30)
                                                  * ==> 20 (side effect, set a := 10 and b := 20) */
                    ;
            });

            PARENS(AST_Binary, function (output) {
                var p = output.parent();
                // (foo && bar)()
                if (p instanceof AST_Call && p.expression === this)
                    return true;
                // typeof (foo && bar)
                if (p instanceof AST_Unary)
                    return true;
                // (foo && bar)["prop"], (foo && bar).prop
                if (p instanceof AST_PropAccess && p.expression === this)
                    return true;
                // this deals with precedence: 3 * (2 + 1)
                if (p instanceof AST_Binary) {
                    var po = p.operator, pp = PRECEDENCE[po];
                    var so = this.operator, sp = PRECEDENCE[so];
                    if (pp > sp
                        || (pp == sp
                            && this === p.right)) {
                        return true;
                    }
                }
            });

            PARENS(AST_PropAccess, function (output) {
                var p = output.parent();
                if (p instanceof AST_New && p.expression === this) {
                    // i.e. new (foo.bar().baz)
                    //
                    // if there's one call into this subtree, then we need
                    // parens around it too, otherwise the call will be
                    // interpreted as passing the arguments to the upper New
                    // expression.
                    try {
                        this.walk(new TreeWalker(function (node) {
                            if (node instanceof AST_Call) throw p;
                        }));
                    } catch (ex) {
                        if (ex !== p) throw ex;
                        return true;
                    }
                }
            });

            PARENS(AST_Call, function (output) {
                var p = output.parent(), p1;
                if (p instanceof AST_New && p.expression === this)
                    return true;

                // workaround for Safari bug.
                // https://bugs.webkit.org/show_bug.cgi?id=123506
                return this.expression instanceof AST_Function
                    && p instanceof AST_PropAccess
                    && p.expression === this
                    && (p1 = output.parent(1)) instanceof AST_Assign
                    && p1.left === p;
            });

            PARENS(AST_New, function (output) {
                var p = output.parent();
                if (no_constructor_parens(this, output)
                    && (p instanceof AST_PropAccess // (new Date).getTime(), (new Date)["getTime"]()
                        || p instanceof AST_Call && p.expression === this)) // (new foo)(bar)
                    return true;
            });

            PARENS(AST_Number, function (output) {
                var p = output.parent();
                if (this.getValue() < 0 && p instanceof AST_PropAccess && p.expression === this)
                    return true;
            });

            PARENS([AST_Assign, AST_Conditional], function (output) {
                var p = output.parent();
                // !(a = false) → true
                if (p instanceof AST_Unary)
                    return true;
                // 1 + (a = 2) + 3 → 6, side effect setting a = 2
                if (p instanceof AST_Binary && !(p instanceof AST_Assign))
                    return true;
                // (a = func)() —or— new (a = Object)()
                if (p instanceof AST_Call && p.expression === this)
                    return true;
                // (a = foo) ? bar : baz
                if (p instanceof AST_Conditional && p.condition === this)
                    return true;
                // (a = foo)["prop"] —or— (a = foo).prop
                if (p instanceof AST_PropAccess && p.expression === this)
                    return true;
            });

            /* -----[ PRINTERS ]----- */

            DEFPRINT(AST_Directive, function (self, output) {
                output.print_string(self.value, self.quote);
                output.semicolon();
            });
            DEFPRINT(AST_Debugger, function (self, output) {
                output.print("debugger");
                output.semicolon();
            });

            /* -----[ statements ]----- */

            function display_body(body, is_toplevel, output) {
                var last = body.length - 1;
                body.forEach(function (stmt, i) {
                    if (!(stmt instanceof AST_EmptyStatement)) {
                        output.indent();
                        stmt.print(output);
                        if (!(i == last && is_toplevel)) {
                            output.newline();
                            if (is_toplevel) output.newline();
                        }
                    }
                });
            };

            AST_StatementWithBody.DEFMETHOD("_do_print_body", function (output) {
                force_statement(this.body, output);
            });

            DEFPRINT(AST_Statement, function (self, output) {
                self.body.print(output);
                output.semicolon();
            });
            DEFPRINT(AST_Toplevel, function (self, output) {
                display_body(self.body, true, output);
                output.print("");
            });
            DEFPRINT(AST_LabeledStatement, function (self, output) {
                self.label.print(output);
                output.colon();
                self.body.print(output);
            });
            DEFPRINT(AST_SimpleStatement, function (self, output) {
                self.body.print(output);
                output.semicolon();
            });

            function print_bracketed(body, output) {
                if (body.length > 0) output.with_block(function () {
                    display_body(body, false, output);
                });
                else output.print("{}");
            };
            DEFPRINT(AST_BlockStatement, function (self, output) {
                print_bracketed(self.body, output);
            });
            DEFPRINT(AST_EmptyStatement, function (self, output) {
                output.semicolon();
            });
            DEFPRINT(AST_Do, function (self, output) {
                output.print("do");
                output.space();
                self._do_print_body(output);
                output.space();
                output.print("while");
                output.space();
                output.with_parens(function () {
                    self.condition.print(output);
                });
                output.semicolon();
            });
            DEFPRINT(AST_While, function (self, output) {
                output.print("while");
                output.space();
                output.with_parens(function () {
                    self.condition.print(output);
                });
                output.space();
                self._do_print_body(output);
            });
            DEFPRINT(AST_For, function (self, output) {
                output.print("fo" + "r");
                output.space();
                output.with_parens(function () {
                    if (self.init && !(self.init instanceof AST_EmptyStatement)) {
                        if (self.init instanceof AST_Definitions) {
                            self.init.print(output);
                        } else {
                            parenthesize_for_noin(self.init, output, true);
                        }
                        output.print(";");
                        output.space();
                    } else {
                        output.print(";");
                    }
                    if (self.condition) {
                        self.condition.print(output);
                        output.print(";");
                        output.space();
                    } else {
                        output.print(";");
                    }
                    if (self.step) {
                        self.step.print(output);
                    }
                });
                output.space();
                self._do_print_body(output);
            });
            DEFPRINT(AST_ForIn, function (self, output) {
                output.print("fo" + "r");
                output.space();
                output.with_parens(function () {
                    self.init.print(output);
                    output.space();
                    output.print("in");
                    output.space();
                    self.object.print(output);
                });
                output.space();
                self._do_print_body(output);
            });
            DEFPRINT(AST_With, function (self, output) {
                output.print("with");
                output.space();
                output.with_parens(function () {
                    self.expression.print(output);
                });
                output.space();
                self._do_print_body(output);
            });

            /* -----[ functions ]----- */
            AST_Lambda.DEFMETHOD("_do_print", function (output, nokeyword) {
                var self = this;
                if (!nokeyword) {
                    output.print("function");
                }
                if (self.name) {
                    output.space();
                    self.name.print(output);
                }
                output.with_parens(function () {
                    self.argnames.forEach(function (arg, i) {
                        if (i) output.comma();
                        arg.print(output);
                    });
                });
                output.space();
                print_bracketed(self.body, output);
            });
            DEFPRINT(AST_Lambda, function (self, output) {
                self._do_print(output);
            });

            /* -----[ exits ]----- */
            AST_Exit.DEFMETHOD("_do_print", function (output, kind) {
                output.print(kind);
                if (this.value) {
                    output.space();
                    this.value.print(output);
                }
                output.semicolon();
            });
            DEFPRINT(AST_Return, function (self, output) {
                self._do_print(output, "return");
            });
            DEFPRINT(AST_Throw, function (self, output) {
                self._do_print(output, "throw");
            });

            /* -----[ loop control ]----- */
            AST_LoopControl.DEFMETHOD("_do_print", function (output, kind) {
                output.print(kind);
                if (this.label) {
                    output.space();
                    this.label.print(output);
                }
                output.semicolon();
            });
            DEFPRINT(AST_Break, function (self, output) {
                self._do_print(output, "break");
            });
            DEFPRINT(AST_Continue, function (self, output) {
                self._do_print(output, "continue");
            });

            /* -----[ if ]----- */
            function make_then(self, output) {
                if (output.option("bracketize")) {
                    make_block(self.body, output);
                    return;
                }
                // The squeezer replaces "block"-s that contain only a single
                // statement with the statement itself; technically, the AST
                // is correct, but this can create problems when we output an
                // IF having an ELSE clause where the THEN clause ends in an
                // IF *without* an ELSE block (then the outer ELSE would refer
                // to the inner IF).  This function checks for this case and
                // adds the block brackets if needed.
                if (!self.body)
                    return output.force_semicolon();
                if (self.body instanceof AST_Do
                    && !output.option("screw_ie8")) {
                    // https://github.com/mishoo/UglifyJS/issues/#issue/57 IE
                    // croaks with "syntax error" on code like this: if (foo)
                    // do ... while(cond); else ...  we need block brackets
                    // around do/while
                    make_block(self.body, output);
                    return;
                }
                var b = self.body;
                while (true) {
                    if (b instanceof AST_If) {
                        if (!b.alternative) {
                            make_block(self.body, output);
                            return;
                        }
                        b = b.alternative;
                    } else if (b instanceof AST_StatementWithBody) {
                        b = b.body;
                    } else break;
                }
                force_statement(self.body, output);
            };
            DEFPRINT(AST_If, function (self, output) {
                output.print("if");
                output.space();
                output.with_parens(function () {
                    self.condition.print(output);
                });
                output.space();
                if (self.alternative) {
                    make_then(self, output);
                    output.space();
                    output.print("else");
                    output.space();
                    force_statement(self.alternative, output);
                } else {
                    self._do_print_body(output);
                }
            });

            /* -----[ switch ]----- */
            DEFPRINT(AST_Switch, function (self, output) {
                output.print("switch");
                output.space();
                output.with_parens(function () {
                    self.expression.print(output);
                });
                output.space();
                if (self.body.length > 0) output.with_block(function () {
                    self.body.forEach(function (stmt, i) {
                        if (i) output.newline();
                        output.indent(true);
                        stmt.print(output);
                    });
                });
                else output.print("{}");
            });
            AST_SwitchBranch.DEFMETHOD("_do_print_body", function (output) {
                if (this.body.length > 0) {
                    output.newline();
                    this.body.forEach(function (stmt) {
                        output.indent();
                        stmt.print(output);
                        output.newline();
                    });
                }
            });
            DEFPRINT(AST_Default, function (self, output) {
                output.print("default:");
                self._do_print_body(output);
            });
            DEFPRINT(AST_Case, function (self, output) {
                output.print("case");
                output.space();
                self.expression.print(output);
                output.print(":");
                self._do_print_body(output);
            });

            /* -----[ exceptions ]----- */
            DEFPRINT(AST_Try, function (self, output) {
                output.print("try");
                output.space();
                print_bracketed(self.body, output);
                if (self.bcatch) {
                    output.space();
                    self.bcatch.print(output);
                }
                if (self.bfinally) {
                    output.space();
                    self.bfinally.print(output);
                }
            });
            DEFPRINT(AST_Catch, function (self, output) {
                output.print("catch");
                output.space();
                output.with_parens(function () {
                    self.argname.print(output);
                });
                output.space();
                print_bracketed(self.body, output);
            });
            DEFPRINT(AST_Finally, function (self, output) {
                output.print("finally");
                output.space();
                print_bracketed(self.body, output);
            });

            /* -----[ var/const ]----- */
            AST_Definitions.DEFMETHOD("_do_print", function (output, kind) {
                output.print(kind);
                output.space();
                this.definitions.forEach(function (def, i) {
                    if (i) output.comma();
                    def.print(output);
                });
                var p = output.parent();
                var in_for = p instanceof AST_For || p instanceof AST_ForIn;
                var avoid_semicolon = in_for && p.init === this;
                if (!avoid_semicolon)
                    output.semicolon();
            });
            DEFPRINT(AST_Var, function (self, output) {
                self._do_print(output, "var");
            });
            DEFPRINT(AST_Const, function (self, output) {
                self._do_print(output, "const");
            });

            function parenthesize_for_noin(node, output, noin) {
                if (!noin) node.print(output);
                else try {
                    // need to take some precautions here:
                    //    https://github.com/mishoo/UglifyJS2/issues/60
                    node.walk(new TreeWalker(function (node) {
                        if (node instanceof AST_Binary && node.operator == "in")
                            throw output;
                    }));
                    node.print(output);
                } catch (ex) {
                    if (ex !== output) throw ex;
                    node.print(output, true);
                }
            };

            DEFPRINT(AST_VarDef, function (self, output) {
                self.name.print(output);
                if (self.value) {
                    output.space();
                    output.print("=");
                    output.space();
                    var p = output.parent(1);
                    var noin = p instanceof AST_For || p instanceof AST_ForIn;
                    parenthesize_for_noin(self.value, output, noin);
                }
            });

            /* -----[ other expressions ]----- */
            DEFPRINT(AST_Call, function (self, output) {
                self.expression.print(output);
                if (self instanceof AST_New && no_constructor_parens(self, output))
                    return;
                output.with_parens(function () {
                    self.args.forEach(function (expr, i) {
                        if (i) output.comma();
                        expr.print(output);
                    });
                });
            });
            DEFPRINT(AST_New, function (self, output) {
                output.print("new");
                output.space();
                AST_Call.prototype._codegen(self, output);
            });

            AST_Seq.DEFMETHOD("_do_print", function (output) {
                this.car.print(output);
                if (this.cdr) {
                    output.comma();
                    if (output.should_break()) {
                        output.newline();
                        output.indent();
                    }
                    this.cdr.print(output);
                }
            });
            DEFPRINT(AST_Seq, function (self, output) {
                self._do_print(output);
                // var p = output.parent();
                // if (p instanceof AST_Statement) {
                //     output.with_indent(output.next_indent(), function(){
                //         self._do_print(output);
                //     });
                // } else {
                //     self._do_print(output);
                // }
            });
            DEFPRINT(AST_Dot, function (self, output) {
                var expr = self.expression;
                expr.print(output);
                if (expr instanceof AST_Number && expr.getValue() >= 0) {
                    if (!/[xa-f.]/i.test(output.last())) {
                        output.print(".");
                    }
                }
                output.print(".");
                // the name after dot would be mapped about here.
                output.add_mapping(self.end);
                output.print_name(self.property);
            });
            DEFPRINT(AST_Sub, function (self, output) {
                self.expression.print(output);
                output.print("[");
                self.property.print(output);
                output.print("]");
            });
            DEFPRINT(AST_UnaryPrefix, function (self, output) {
                var op = self.operator;
                output.print(op);
                if (/^[a-z]/i.test(op)
                    || (/[+-]$/.test(op)
                        && self.expression instanceof AST_UnaryPrefix
                        && /^[+-]/.test(self.expression.operator))) {
                    output.space();
                }
                self.expression.print(output);
            });
            DEFPRINT(AST_UnaryPostfix, function (self, output) {
                self.expression.print(output);
                output.print(self.operator);
            });
            DEFPRINT(AST_Binary, function (self, output) {
                var op = self.operator;
                self.left.print(output);
                if (op[0] == ">" /* ">>" ">>>" ">" ">=" */
                    && self.left instanceof AST_UnaryPostfix
                    && self.left.operator == "--") {
                    // space is mandatory to avoid outputting -->
                    output.print(" ");
                } else {
                    // the space is optional depending on "beautify"
                    output.space();
                }
                output.print(op);
                if ((op == "<" || op == "<<")
                    && self.right instanceof AST_UnaryPrefix
                    && self.right.operator == "!"
                    && self.right.expression instanceof AST_UnaryPrefix
                    && self.right.expression.operator == "--") {
                    // space is mandatory to avoid outputting <!--
                    output.print(" ");
                } else {
                    // the space is optional depending on "beautify"
                    output.space();
                }
                self.right.print(output);
            });
            DEFPRINT(AST_Conditional, function (self, output) {
                self.condition.print(output);
                output.space();
                output.print("?");
                output.space();
                self.consequent.print(output);
                output.space();
                output.colon();
                self.alternative.print(output);
            });

            /* -----[ literals ]----- */
            DEFPRINT(AST_Array, function (self, output) {
                output.with_square(function () {
                    var a = self.elements, len = a.length;
                    if (len > 0) output.space();
                    a.forEach(function (exp, i) {
                        if (i) output.comma();
                        exp.print(output);
                        // If the final element is a hole, we need to make sure it
                        // doesn't look like a trailing comma, by inserting an actual
                        // trailing comma.
                        if (i === len - 1 && exp instanceof AST_Hole)
                            output.comma();
                    });
                    if (len > 0) output.space();
                });
            });
            DEFPRINT(AST_Object, function (self, output) {
                if (self.properties.length > 0) output.with_block(function () {
                    self.properties.forEach(function (prop, i) {
                        if (i) {
                            output.print(",");
                            output.newline();
                        }
                        output.indent();
                        prop.print(output);
                    });
                    output.newline();
                });
                else output.print("{}");
            });
            DEFPRINT(AST_ObjectKeyVal, function (self, output) {
                var key = self.key;
                var quote = self.quote;
                if (output.option("quote_keys")) {
                    output.print_string(key + "");
                } else if ((typeof key == "number"
                    || !output.option("beautify")
                    && +key + "" == key)
                    && parseFloat(key) >= 0) {
                    output.print(make_num(key));
                } else if (RESERVED_WORDS(key) ? output.option("screw_ie8") : is_identifier_string(key)) {
                    output.print_name(key);
                } else {
                    output.print_string(key, quote);
                }
                output.colon();
                self.value.print(output);
            });
            DEFPRINT(AST_ObjectSetter, function (self, output) {
                output.print("set");
                output.space();
                self.key.print(output);
                self.value._do_print(output, true);
            });
            DEFPRINT(AST_ObjectGetter, function (self, output) {
                output.print("get");
                output.space();
                self.key.print(output);
                self.value._do_print(output, true);
            });
            DEFPRINT(AST_Symbol, function (self, output) {
                var def = self.definition();
                output.print_name(def ? def.mangled_name || def.name : self.name);
            });
            DEFPRINT(AST_Undefined, function (self, output) {
                output.print("void 0");
            });
            DEFPRINT(AST_Hole, noop);
            DEFPRINT(AST_Infinity, function (self, output) {
                output.print("Infinity");
            });
            DEFPRINT(AST_NaN, function (self, output) {
                output.print("NaN");
            });
            DEFPRINT(AST_This, function (self, output) {
                output.print("this");
            });
            DEFPRINT(AST_Constant, function (self, output) {
                output.print(self.getValue());
            });
            DEFPRINT(AST_String, function (self, output) {
                output.print_string(self.getValue(), self.quote);
            });
            DEFPRINT(AST_Number, function (self, output) {
                if (use_asm && self.start.raw != null) {
                    output.print(self.start.raw);
                } else {
                    output.print(make_num(self.getValue()));
                }
            });

            function regexp_safe_literal(code) {
                return [
                    0x5c, // \
                    0x2f, // /
                    0x2e, // .
                    0x2b, // +
                    0x2a, // *
                    0x3f, // ?
                    0x28, // (
                    0x29, // )
                    0x5b, // [
                    0x5d, // ]
                    0x7b, // {
                    0x7d, // }
                    0x24, // $
                    0x5e, // ^
                    0x3a, // :
                    0x7c, // |
                    0x21, // !
                    0x0a, // \n
                    0x0d, // \r
                    0x00, // \0
                    0xfeff, // Unicode BOM
                    0x2028, // unicode "line separator"
                    0x2029, // unicode "paragraph separator"
                ].indexOf(code) < 0;
            };

            DEFPRINT(AST_RegExp, function (self, output) {
                var str = self.getValue().toString();
                if (output.option("ascii_only")) {
                    str = output.to_ascii(str);
                } else if (output.option("unescape_regexps")) {
                    str = str.split("\\\\").map(function (str) {
                        return str.replace(/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/g, function (s) {
                            var code = parseInt(s.substr(2), 16);
                            return regexp_safe_literal(code) ? String.fromCharCode(code) : s;
                        });
                    }).join("\\\\");
                }
                output.print(str);
                var p = output.parent();
                if (p instanceof AST_Binary && /^in/.test(p.operator) && p.left === self)
                    output.print(" ");
            });

            function force_statement(stat, output) {
                if (output.option("bracketize")) {
                    if (!stat || stat instanceof AST_EmptyStatement)
                        output.print("{}");
                    else if (stat instanceof AST_BlockStatement)
                        stat.print(output);
                    else output.with_block(function () {
                            output.indent();
                            stat.print(output);
                            output.newline();
                        });
                } else {
                    if (!stat || stat instanceof AST_EmptyStatement)
                        output.force_semicolon();
                    else
                        stat.print(output);
                }
            };

            // return true if the node at the top of the stack (that means the
            // innermost node in the current output) is lexically the first in
            // a statement.
            function first_in_statement(output) {
                var a = output.stack(), i = a.length, node = a[--i], p = a[--i];
                while (i > 0) {
                    if (p instanceof AST_Statement && p.body === node)
                        return true;
                    if ((p instanceof AST_Seq && p.car === node) ||
                        (p instanceof AST_Call && p.expression === node && !(p instanceof AST_New)) ||
                        (p instanceof AST_Dot && p.expression === node) ||
                        (p instanceof AST_Sub && p.expression === node) ||
                        (p instanceof AST_Conditional && p.condition === node) ||
                        (p instanceof AST_Binary && p.left === node) ||
                        (p instanceof AST_UnaryPostfix && p.expression === node)) {
                        node = p;
                        p = a[--i];
                    } else {
                        return false;
                    }
                }
            };

            // self should be AST_New.  decide if we want to show parens or not.
            function no_constructor_parens(self, output) {
                return self.args.length == 0 && !output.option("beautify");
            };

            function best_of(a) {
                var best = a[0], len = best.length;
                for (var i = 1; i < a.length; ++i) {
                    if (a[i].length < len) {
                        best = a[i];
                        len = best.length;
                    }
                }
                return best;
            };

            function make_num(num) {
                var str = num.toString(10), a = [str.replace(/^0\./, ".").replace('e+', 'e')], m;
                if (Math.floor(num) === num) {
                    if (num >= 0) {
                        a.push("0x" + num.toString(16).toLowerCase(), // probably pointless
                            "0" + num.toString(8)); // same.
                    } else {
                        a.push("-0x" + (-num).toString(16).toLowerCase(), // probably pointless
                            "-0" + (-num).toString(8)); // same.
                    }
                    if ((m = /^(.*?)(0+)$/.exec(num))) {
                        a.push(m[1] + "e" + m[2].length);
                    }
                } else if ((m = /^0?\.(0+)(.*)$/.exec(num))) {
                    a.push(m[2] + "e-" + (m[1].length + m[2].length),
                        str.substr(str.indexOf(".")));
                }
                return best_of(a);
            };

            function make_block(stmt, output) {
                if (stmt instanceof AST_BlockStatement) {
                    stmt.print(output);
                    return;
                }
                output.with_block(function () {
                    output.indent();
                    stmt.print(output);
                    output.newline();
                });
            };

            /* -----[ source map generators ]----- */

            function DEFMAP(nodetype, generator) {
                nodetype.DEFMETHOD("add_source_map", function (stream) {
                    generator(this, stream);
                });
            };

            // We could easily add info for ALL nodes, but it seems to me that
            // would be quite wasteful, hence this noop in the base class.
            DEFMAP(AST_Node, noop);

            function basic_sourcemap_gen(self, output) {
                output.add_mapping(self.start);
            };

            // XXX: I'm not exactly sure if we need it for all of these nodes,
            // or if we should add even more.

            DEFMAP(AST_Directive, basic_sourcemap_gen);
            DEFMAP(AST_Debugger, basic_sourcemap_gen);
            DEFMAP(AST_Symbol, basic_sourcemap_gen);
            DEFMAP(AST_Jump, basic_sourcemap_gen);
            DEFMAP(AST_StatementWithBody, basic_sourcemap_gen);
            DEFMAP(AST_LabeledStatement, noop); // since the label symbol will mark it
            DEFMAP(AST_Lambda, basic_sourcemap_gen);
            DEFMAP(AST_Switch, basic_sourcemap_gen);
            DEFMAP(AST_SwitchBranch, basic_sourcemap_gen);
            DEFMAP(AST_BlockStatement, basic_sourcemap_gen);
            DEFMAP(AST_Toplevel, noop);
            DEFMAP(AST_New, basic_sourcemap_gen);
            DEFMAP(AST_Try, basic_sourcemap_gen);
            DEFMAP(AST_Catch, basic_sourcemap_gen);
            DEFMAP(AST_Finally, basic_sourcemap_gen);
            DEFMAP(AST_Definitions, basic_sourcemap_gen);
            DEFMAP(AST_Constant, basic_sourcemap_gen);
            DEFMAP(AST_ObjectSetter, function (self, output) {
                output.add_mapping(self.start, self.key.name);
            });
            DEFMAP(AST_ObjectGetter, function (self, output) {
                output.add_mapping(self.start, self.key.name);
            });
            DEFMAP(AST_ObjectProperty, function (self, output) {
                output.add_mapping(self.start, self.key);
            });

        })();

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function Compressor(options, false_by_default) {
            if (!(this instanceof Compressor))
                return new Compressor(options, false_by_default);
            TreeTransformer.call(this, this.before, this.after);
            this.options = defaults(options, {
                sequences: !false_by_default,
                properties: !false_by_default,
                dead_code: !false_by_default,
                drop_debugger: !false_by_default,
                unsafe: false,
                unsafe_comps: false,
                conditionals: !false_by_default,
                comparisons: !false_by_default,
                evaluate: !false_by_default,
                booleans: !false_by_default,
                loops: !false_by_default,
                unused: !false_by_default,
                hoist_funs: !false_by_default,
                keep_fargs: true,
                keep_fnames: false,
                hoist_vars: false,
                if_return: !false_by_default,
                join_vars: !false_by_default,
                cascade: !false_by_default,
                side_effects: !false_by_default,
                pure_getters: false,
                pure_funcs: null,
                negate_iife: !false_by_default,
                screw_ie8: false,
                drop_console: false,
                angular: false,

                warnings: true,
                global_defs: {}
            }, true);
        };

        Compressor.prototype = new TreeTransformer;
        merge(Compressor.prototype, {
            option: function (key) {
                return this.options[key]
            },
            warn: function () {
                if (this.options.warnings)
                    AST_Node.warn.apply(AST_Node, arguments);
            },
            before: function (node, descend, in_list) {
                if (node._squeezed) return node;
                var was_scope = false;
                if (node instanceof AST_Scope) {
                    node = node.hoist_declarations(this);
                    was_scope = true;
                }
                descend(node, this);
                node = node.optimize(this);
                if (was_scope && node instanceof AST_Scope) {
                    node.drop_unused(this);
                    descend(node, this);
                }
                node._squeezed = true;
                return node;
            }
        });

        (function () {

            function OPT(node, optimizer) {
                node.DEFMETHOD("optimize", function (compressor) {
                    var self = this;
                    if (self._optimized) return self;
                    if (compressor.has_directive("use asm")) return self;
                    var opt = optimizer(self, compressor);
                    opt._optimized = true;
                    if (opt === self) return opt;
                    return opt.transform(compressor);
                });
            };

            OPT(AST_Node, function (self, compressor) {
                return self;
            });

            AST_Node.DEFMETHOD("equivalent_to", function (node) {
                // XXX: this is a rather expensive way to test two node's equivalence:
                return this.print_to_string() == node.print_to_string();
            });

            function make_node(ctor, orig, props) {
                if (!props) props = {};
                if (orig) {
                    if (!props.start) props.start = orig.start;
                    if (!props.end) props.end = orig.end;
                }
                return new ctor(props);
            };

            function make_node_from_constant(compressor, val, orig) {
                // XXX: WIP.
                // if (val instanceof AST_Node) return val.transform(new TreeTransformer(null, function(node){
                //     if (node instanceof AST_SymbolRef) {
                //         var scope = compressor.find_parent(AST_Scope);
                //         var def = scope.find_variable(node);
                //         node.thedef = def;
                //         return node;
                //     }
                // })).transform(compressor);

                if (val instanceof AST_Node) return val.transform(compressor);
                switch (typeof val) {
                    case "string":
                        return make_node(AST_String, orig, {
                            value: val
                        }).optimize(compressor);
                    case "number":
                        return make_node(isNaN(val) ? AST_NaN : AST_Number, orig, {
                            value: val
                        }).optimize(compressor);
                    case "boolean":
                        return make_node(val ? AST_True : AST_False, orig).optimize(compressor);
                    case "undefined":
                        return make_node(AST_Undefined, orig).optimize(compressor);
                    default:
                        if (val === null) {
                            return make_node(AST_Null, orig, {value: null}).optimize(compressor);
                        }
                        if (val instanceof RegExp) {
                            return make_node(AST_RegExp, orig, {value: val}).optimize(compressor);
                        }
                        throw new Error(string_template("Can't handle constant of type: {type}", {
                            type: typeof val
                        }));
                }
            };

            function as_statement_array(thing) {
                if (thing === null) return [];
                if (thing instanceof AST_BlockStatement) return thing.body;
                if (thing instanceof AST_EmptyStatement) return [];
                if (thing instanceof AST_Statement) return [thing];
                throw new Error("Can't convert thing to statement array");
            };

            function is_empty(thing) {
                if (thing === null) return true;
                if (thing instanceof AST_EmptyStatement) return true;
                if (thing instanceof AST_BlockStatement) return thing.body.length == 0;
                return false;
            };

            function loop_body(x) {
                if (x instanceof AST_Switch) return x;
                if (x instanceof AST_For || x instanceof AST_ForIn || x instanceof AST_DWLoop) {
                    return (x.body instanceof AST_BlockStatement ? x.body : x);
                }
                return x;
            };

            function tighten_body(statements, compressor) {
                var CHANGED, max_iter = 10;
                do {
                    CHANGED = false;
                    if (compressor.option("angular")) {
                        statements = process_for_angular(statements);
                    }
                    statements = eliminate_spurious_blocks(statements);
                    if (compressor.option("dead_code")) {
                        statements = eliminate_dead_code(statements, compressor);
                    }
                    if (compressor.option("if_return")) {
                        statements = handle_if_return(statements, compressor);
                    }
                    if (compressor.option("sequences")) {
                        statements = sequencesize(statements, compressor);
                    }
                    if (compressor.option("join_vars")) {
                        statements = join_consecutive_vars(statements, compressor);
                    }
                } while (CHANGED && max_iter-- > 0);

                if (compressor.option("negate_iife")) {
                    negate_iifes(statements, compressor);
                }

                return statements;

                function process_for_angular(statements) {
                    function has_inject(comment) {
                        return /@ngInject/.test(comment.value);
                    }

                    function make_arguments_names_list(func) {
                        return func.argnames.map(function (sym) {
                            return make_node(AST_String, sym, {value: sym.name});
                        });
                    }

                    function make_array(orig, elements) {
                        return make_node(AST_Array, orig, {elements: elements});
                    }

                    function make_injector(func, name) {
                        return make_node(AST_SimpleStatement, func, {
                            body: make_node(AST_Assign, func, {
                                operator: "=",
                                left: make_node(AST_Dot, name, {
                                    expression: make_node(AST_SymbolRef, name, name),
                                    property: "$inject"
                                }),
                                right: make_array(func, make_arguments_names_list(func))
                            })
                        });
                    }

                    function check_expression(body) {
                        if (body && body.args) {
                            // if this is a function call check all of arguments passed
                            body.args.forEach(function (argument, index, array) {
                                var comments = argument.start.comments_before;
                                // if the argument is function preceded by @ngInject
                                if (argument instanceof AST_Lambda && comments.length && has_inject(comments[0])) {
                                    // replace the function with an array of names of its parameters and function at the end
                                    array[index] = make_array(argument, make_arguments_names_list(argument).concat(argument));
                                }
                            });
                            // if this is chained call check previous one recursively
                            if (body.expression && body.expression.expression) {
                                check_expression(body.expression.expression);
                            }
                        }
                    }

                    return statements.reduce(function (a, stat) {
                        a.push(stat);

                        if (stat.body && stat.body.args) {
                            check_expression(stat.body);
                        } else {
                            var token = stat.start;
                            var comments = token.comments_before;
                            if (comments && comments.length > 0) {
                                var last = comments.pop();
                                if (has_inject(last)) {
                                    // case 1: defun
                                    if (stat instanceof AST_Defun) {
                                        a.push(make_injector(stat, stat.name));
                                    } else if (stat instanceof AST_Definitions) {
                                        stat.definitions.forEach(function (def) {
                                            if (def.value && def.value instanceof AST_Lambda) {
                                                a.push(make_injector(def.value, def.name));
                                            }
                                        });
                                    } else {
                                        compressor.warn("Unknown statement marked with @ngInject [{file}:{line},{col}]", token);
                                    }
                                }
                            }
                        }

                        return a;
                    }, []);
                }

                function eliminate_spurious_blocks(statements) {
                    var seen_dirs = [];
                    return statements.reduce(function (a, stat) {
                        if (stat instanceof AST_BlockStatement) {
                            CHANGED = true;
                            a.push.apply(a, eliminate_spurious_blocks(stat.body));
                        } else if (stat instanceof AST_EmptyStatement) {
                            CHANGED = true;
                        } else if (stat instanceof AST_Directive) {
                            if (seen_dirs.indexOf(stat.value) < 0) {
                                a.push(stat);
                                seen_dirs.push(stat.value);
                            } else {
                                CHANGED = true;
                            }
                        } else {
                            a.push(stat);
                        }
                        return a;
                    }, []);
                };

                function handle_if_return(statements, compressor) {
                    var self = compressor.self();
                    var in_lambda = self instanceof AST_Lambda;
                    var ret = [];
                    loop: for (var i = statements.length; --i >= 0;) {
                        var stat = statements[i];
                        switch (true) {
                            case (in_lambda && stat instanceof AST_Return && !stat.value && ret.length == 0):
                                CHANGED = true;
                                // note, ret.length is probably always zero
                                // because we drop unreachable code before this
                                // step.  nevertheless, it's good to check.
                                continue loop;
                            case stat instanceof AST_If:
                                if (stat.body instanceof AST_Return) {
                                    //---
                                    // pretty silly case, but:
                                    // if (foo()) return; return; ==> foo(); return;
                                    if (((in_lambda && ret.length == 0)
                                        || (ret[0] instanceof AST_Return && !ret[0].value))
                                        && !stat.body.value && !stat.alternative) {
                                        CHANGED = true;
                                        var cond = make_node(AST_SimpleStatement, stat.condition, {
                                            body: stat.condition
                                        });
                                        ret.unshift(cond);
                                        continue loop;
                                    }
                                    //---
                                    // if (foo()) return x; return y; ==> return foo() ? x : y;
                                    if (ret[0] instanceof AST_Return && stat.body.value && ret[0].value && !stat.alternative) {
                                        CHANGED = true;
                                        stat = stat.clone();
                                        stat.alternative = ret[0];
                                        ret[0] = stat.transform(compressor);
                                        continue loop;
                                    }
                                    //---
                                    // if (foo()) return x; [ return ; ] ==> return foo() ? x : undefined;
                                    if ((ret.length == 0 || ret[0] instanceof AST_Return) && stat.body.value && !stat.alternative && in_lambda) {
                                        CHANGED = true;
                                        stat = stat.clone();
                                        stat.alternative = ret[0] || make_node(AST_Return, stat, {
                                            value: make_node(AST_Undefined, stat)
                                        });
                                        ret[0] = stat.transform(compressor);
                                        continue loop;
                                    }
                                    //---
                                    // if (foo()) return; [ else x... ]; y... ==> if (!foo()) { x...; y... }
                                    if (!stat.body.value && in_lambda) {
                                        CHANGED = true;
                                        stat = stat.clone();
                                        stat.condition = stat.condition.negate(compressor);
                                        stat.body = make_node(AST_BlockStatement, stat, {
                                            body: as_statement_array(stat.alternative).concat(ret)
                                        });
                                        stat.alternative = null;
                                        ret = [stat.transform(compressor)];
                                        continue loop;
                                    }
                                    //---
                                    // XXX: what was the intention of this case?
                                    // if sequences is not enabled, this can lead to an endless loop (issue #866).
                                    // however, with sequences on this helps producing slightly better output for
                                    // the example code.
                                    if (compressor.option("sequences")
                                        && ret.length == 1 && in_lambda && ret[0] instanceof AST_SimpleStatement
                                        && (!stat.alternative || stat.alternative instanceof AST_SimpleStatement)) {
                                        CHANGED = true;
                                        ret.push(make_node(AST_Return, ret[0], {
                                            value: make_node(AST_Undefined, ret[0])
                                        }).transform(compressor));
                                        ret = as_statement_array(stat.alternative).concat(ret);
                                        ret.unshift(stat);
                                        continue loop;
                                    }
                                }

                                var ab = aborts(stat.body);
                                var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                                if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda)
                                    || (ab instanceof AST_Continue && self === loop_body(lct))
                                    || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                                    if (ab.label) {
                                        remove(ab.label.thedef.references, ab);
                                    }
                                    CHANGED = true;
                                    var body = as_statement_array(stat.body).slice(0, -1);
                                    stat = stat.clone();
                                    stat.condition = stat.condition.negate(compressor);
                                    stat.body = make_node(AST_BlockStatement, stat, {
                                        body: as_statement_array(stat.alternative).concat(ret)
                                    });
                                    stat.alternative = make_node(AST_BlockStatement, stat, {
                                        body: body
                                    });
                                    ret = [stat.transform(compressor)];
                                    continue loop;
                                }

                                var ab = aborts(stat.alternative);
                                var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                                if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda)
                                    || (ab instanceof AST_Continue && self === loop_body(lct))
                                    || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                                    if (ab.label) {
                                        remove(ab.label.thedef.references, ab);
                                    }
                                    CHANGED = true;
                                    stat = stat.clone();
                                    stat.body = make_node(AST_BlockStatement, stat.body, {
                                        body: as_statement_array(stat.body).concat(ret)
                                    });
                                    stat.alternative = make_node(AST_BlockStatement, stat.alternative, {
                                        body: as_statement_array(stat.alternative).slice(0, -1)
                                    });
                                    ret = [stat.transform(compressor)];
                                    continue loop;
                                }

                                ret.unshift(stat);
                                break;
                            default:
                                ret.unshift(stat);
                                break;
                        }
                    }
                    return ret;
                };

                function eliminate_dead_code(statements, compressor) {
                    var has_quit = false;
                    var orig = statements.length;
                    var self = compressor.self();
                    statements = statements.reduce(function (a, stat) {
                        if (has_quit) {
                            extract_declarations_from_unreachable_code(compressor, stat, a);
                        } else {
                            if (stat instanceof AST_LoopControl) {
                                var lct = compressor.loopcontrol_target(stat.label);
                                if ((stat instanceof AST_Break
                                    && lct instanceof AST_BlockStatement
                                    && loop_body(lct) === self) || (stat instanceof AST_Continue
                                    && loop_body(lct) === self)) {
                                    if (stat.label) {
                                        remove(stat.label.thedef.references, stat);
                                    }
                                } else {
                                    a.push(stat);
                                }
                            } else {
                                a.push(stat);
                            }
                            if (aborts(stat)) has_quit = true;
                        }
                        return a;
                    }, []);
                    CHANGED = statements.length != orig;
                    return statements;
                };

                function sequencesize(statements, compressor) {
                    if (statements.length < 2) return statements;
                    var seq = [], ret = [];

                    function push_seq() {
                        seq = AST_Seq.from_array(seq);
                        if (seq) ret.push(make_node(AST_SimpleStatement, seq, {
                            body: seq
                        }));
                        seq = [];
                    };
                    statements.forEach(function (stat) {
                        if (stat instanceof AST_SimpleStatement && seq.length < 2000) seq.push(stat.body);
                        else push_seq(), ret.push(stat);
                    });
                    push_seq();
                    ret = sequencesize_2(ret, compressor);
                    CHANGED = ret.length != statements.length;
                    return ret;
                };

                function sequencesize_2(statements, compressor) {
                    function cons_seq(right) {
                        ret.pop();
                        var left = prev.body;
                        if (left instanceof AST_Seq) {
                            left.add(right);
                        } else {
                            left = AST_Seq.cons(left, right);
                        }
                        return left.transform(compressor);
                    };
                    var ret = [], prev = null;
                    statements.forEach(function (stat) {
                        if (prev) {
                            if (stat instanceof AST_For) {
                                var opera = {};
                                try {
                                    prev.body.walk(new TreeWalker(function (node) {
                                        if (node instanceof AST_Binary && node.operator == "in")
                                            throw opera;
                                    }));
                                    if (stat.init && !(stat.init instanceof AST_Definitions)) {
                                        stat.init = cons_seq(stat.init);
                                    } else if (!stat.init) {
                                        stat.init = prev.body;
                                        ret.pop();
                                    }
                                } catch (ex) {
                                    if (ex !== opera) throw ex;
                                }
                            } else if (stat instanceof AST_If) {
                                stat.condition = cons_seq(stat.condition);
                            } else if (stat instanceof AST_With) {
                                stat.expression = cons_seq(stat.expression);
                            } else if (stat instanceof AST_Exit && stat.value) {
                                stat.value = cons_seq(stat.value);
                            } else if (stat instanceof AST_Exit) {
                                stat.value = cons_seq(make_node(AST_Undefined, stat));
                            } else if (stat instanceof AST_Switch) {
                                stat.expression = cons_seq(stat.expression);
                            }
                        }
                        ret.push(stat);
                        prev = stat instanceof AST_SimpleStatement ? stat : null;
                    });
                    return ret;
                };

                function join_consecutive_vars(statements, compressor) {
                    var prev = null;
                    return statements.reduce(function (a, stat) {
                        if (stat instanceof AST_Definitions && prev && prev.TYPE == stat.TYPE) {
                            prev.definitions = prev.definitions.concat(stat.definitions);
                            CHANGED = true;
                        } else if (stat instanceof AST_For
                            && prev instanceof AST_Definitions
                            && (!stat.init || stat.init.TYPE == prev.TYPE)) {
                            CHANGED = true;
                            a.pop();
                            if (stat.init) {
                                stat.init.definitions = prev.definitions.concat(stat.init.definitions);
                            } else {
                                stat.init = prev;
                            }
                            a.push(stat);
                            prev = stat;
                        } else {
                            prev = stat;
                            a.push(stat);
                        }
                        return a;
                    }, []);
                };

                function negate_iifes(statements, compressor) {
                    statements.forEach(function (stat) {
                        if (stat instanceof AST_SimpleStatement) {
                            stat.body = (function transform(thing) {
                                return thing.transform(new TreeTransformer(function (node) {
                                    if (node instanceof AST_Call && node.expression instanceof AST_Function) {
                                        return make_node(AST_UnaryPrefix, node, {
                                            operator: "!",
                                            expression: node
                                        });
                                    } else if (node instanceof AST_Call) {
                                        node.expression = transform(node.expression);
                                    } else if (node instanceof AST_Seq) {
                                        node.car = transform(node.car);
                                    } else if (node instanceof AST_Conditional) {
                                        var expr = transform(node.condition);
                                        if (expr !== node.condition) {
                                            // it has been negated, reverse
                                            node.condition = expr;
                                            var tmp = node.consequent;
                                            node.consequent = node.alternative;
                                            node.alternative = tmp;
                                        }
                                    }
                                    return node;
                                }));
                            })(stat.body);
                        }
                    });
                };

            };

            function extract_declarations_from_unreachable_code(compressor, stat, target) {
                compressor.warn("Dropping unreachable code [{file}:{line},{col}]", stat.start);
                stat.walk(new TreeWalker(function (node) {
                    if (node instanceof AST_Definitions) {
                        compressor.warn("Declarations in unreachable code! [{file}:{line},{col}]", node.start);
                        node.remove_initializers();
                        target.push(node);
                        return true;
                    }
                    if (node instanceof AST_Defun) {
                        target.push(node);
                        return true;
                    }
                    if (node instanceof AST_Scope) {
                        return true;
                    }
                }));
            };

            /* -----[ boolean/negation helpers ]----- */

            // methods to determine whether an expression has a boolean result type
            (function (def) {
                var unary_bool = ["!", "delete"];
                var binary_bool = ["in", "instanceof", "==", "!=", "===", "!==", "<", "<=", ">=", ">"];
                def(AST_Node, function () {
                    return false
                });
                def(AST_UnaryPrefix, function () {
                    return member(this.operator, unary_bool);
                });
                def(AST_Binary, function () {
                    return member(this.operator, binary_bool) ||
                        ((this.operator == "&&" || this.operator == "||") &&
                            this.left.is_boolean() && this.right.is_boolean());
                });
                def(AST_Conditional, function () {
                    return this.consequent.is_boolean() && this.alternative.is_boolean();
                });
                def(AST_Assign, function () {
                    return this.operator == "=" && this.right.is_boolean();
                });
                def(AST_Seq, function () {
                    return this.cdr.is_boolean();
                });
                def(AST_True, function () {
                    return true
                });
                def(AST_False, function () {
                    return true
                });
            })(function (node, func) {
                node.DEFMETHOD("is_boolean", func);
            });

            // methods to determine if an expression has a string result type
            (function (def) {
                def(AST_Node, function () {
                    return false
                });
                def(AST_String, function () {
                    return true
                });
                def(AST_UnaryPrefix, function () {
                    return this.operator == "typeof";
                });
                def(AST_Binary, function (compressor) {
                    return this.operator == "+" &&
                        (this.left.is_string(compressor) || this.right.is_string(compressor));
                });
                def(AST_Assign, function (compressor) {
                    return (this.operator == "=" || this.operator == "+=") && this.right.is_string(compressor);
                });
                def(AST_Seq, function (compressor) {
                    return this.cdr.is_string(compressor);
                });
                def(AST_Conditional, function (compressor) {
                    return this.consequent.is_string(compressor) && this.alternative.is_string(compressor);
                });
                def(AST_Call, function (compressor) {
                    return compressor.option("unsafe")
                        && this.expression instanceof AST_SymbolRef
                        && this.expression.name == "String"
                        && this.expression.undeclared();
                });
            })(function (node, func) {
                node.DEFMETHOD("is_string", func);
            });

            function best_of(ast1, ast2) {
                return ast1.print_to_string().length >
                ast2.print_to_string().length
                    ? ast2 : ast1;
            };

            // methods to evaluate a constant expression
            (function (def) {
                // The evaluate method returns an array with one or two
                // elements.  If the node has been successfully reduced to a
                // constant, then the second element tells us the value;
                // otherwise the second element is missing.  The first element
                // of the array is always an AST_Node descendant; if
                // evaluation was successful it's a node that represents the
                // constant; otherwise it's the original or a replacement node.
                AST_Node.DEFMETHOD("evaluate", function (compressor) {
                    if (!compressor.option("evaluate")) return [this];
                    try {
                        var val = this._eval(compressor);
                        return [best_of(make_node_from_constant(compressor, val, this), this), val];
                    } catch (ex) {
                        if (ex !== def) throw ex;
                        return [this];
                    }
                });
                def(AST_Statement, function () {
                    throw new Error(string_template("Cannot evaluate a statement [{file}:{line},{col}]", this.start));
                });
                def(AST_Function, function () {
                    // XXX: AST_Function inherits from AST_Scope, which itself
                    // inherits from AST_Statement; however, an AST_Function
                    // isn't really a statement.  This could byte in other
                    // places too. :-( Wish JS had multiple inheritance.
                    throw def;
                });

                function ev(node, compressor) {
                    if (!compressor) throw new Error("Compressor must be passed");

                    return node._eval(compressor);
                };
                def(AST_Node, function () {
                    throw def;          // not constant
                });
                def(AST_Constant, function () {
                    return this.getValue();
                });
                def(AST_UnaryPrefix, function (compressor) {
                    var e = this.expression;
                    switch (this.operator) {
                        case "!":
                            return !ev(e, compressor);
                        case "typeof":
                            // Function would be evaluated to an array and so typeof would
                            // incorrectly return 'object'. Hence making is a special case.
                            if (e instanceof AST_Function) return typeof function () {
                            };

                            e = ev(e, compressor);

                            // typeof <RegExp> returns "object" or "function" on different platforms
                            // so cannot evaluate reliably
                            if (e instanceof RegExp) throw def;

                            return typeof e;
                        case "void":
                            return void ev(e, compressor);
                        case "~":
                            return ~ev(e, compressor);
                        case "-":
                            e = ev(e, compressor);
                            if (e === 0) throw def;
                            return -e;
                        case "+":
                            return +ev(e, compressor);
                    }
                    throw def;
                });
                def(AST_Binary, function (c) {
                    var left = this.left, right = this.right;
                    switch (this.operator) {
                        case "&&"         :
                            return ev(left, c) && ev(right, c);
                        case "||"         :
                            return ev(left, c) || ev(right, c);
                        case "|"          :
                            return ev(left, c) | ev(right, c);
                        case "&"          :
                            return ev(left, c) & ev(right, c);
                        case "^"          :
                            return ev(left, c) ^ ev(right, c);
                        case "+"          :
                            return ev(left, c) + ev(right, c);
                        case "*"          :
                            return ev(left, c) * ev(right, c);
                        case "/"          :
                            return ev(left, c) / ev(right, c);
                        case "%"          :
                            return ev(left, c) % ev(right, c);
                        case "-"          :
                            return ev(left, c) - ev(right, c);
                        case "<<"         :
                            return ev(left, c) << ev(right, c);
                        case ">>"         :
                            return ev(left, c) >> ev(right, c);
                        case ">>>"        :
                            return ev(left, c) >>> ev(right, c);
                        case "=="         :
                            return ev(left, c) == ev(right, c);
                        case "==="        :
                            return ev(left, c) === ev(right, c);
                        case "!="         :
                            return ev(left, c) != ev(right, c);
                        case "!=="        :
                            return ev(left, c) !== ev(right, c);
                        case "<"          :
                            return ev(left, c) < ev(right, c);
                        case "<="         :
                            return ev(left, c) <= ev(right, c);
                        case ">"          :
                            return ev(left, c) > ev(right, c);
                        case ">="         :
                            return ev(left, c) >= ev(right, c);
                        case "in"         :
                            return ev(left, c) in ev(right, c);
                        case "instanceof" :
                            return ev(left, c) instanceof ev(right, c);
                    }
                    throw def;
                });
                def(AST_Conditional, function (compressor) {
                    return ev(this.condition, compressor)
                        ? ev(this.consequent, compressor)
                        : ev(this.alternative, compressor);
                });
                def(AST_SymbolRef, function (compressor) {
                    var d = this.definition();
                    if (d && d.constant && d.init) return ev(d.init, compressor);
                    throw def;
                });
                def(AST_Dot, function (compressor) {
                    if (compressor.option("unsafe") && this.property == "length") {
                        var str = ev(this.expression, compressor);
                        if (typeof str == "string")
                            return str.length;
                    }
                    throw def;
                });
            })(function (node, func) {
                node.DEFMETHOD("_eval", func);
            });

            // method to negate an expression
            (function (def) {
                function basic_negation(exp) {
                    return make_node(AST_UnaryPrefix, exp, {
                        operator: "!",
                        expression: exp
                    });
                };
                def(AST_Node, function () {
                    return basic_negation(this);
                });
                def(AST_Statement, function () {
                    throw new Error("Cannot negate a statement");
                });
                def(AST_Function, function () {
                    return basic_negation(this);
                });
                def(AST_UnaryPrefix, function () {
                    if (this.operator == "!")
                        return this.expression;
                    return basic_negation(this);
                });
                def(AST_Seq, function (compressor) {
                    var self = this.clone();
                    self.cdr = self.cdr.negate(compressor);
                    return self;
                });
                def(AST_Conditional, function (compressor) {
                    var self = this.clone();
                    self.consequent = self.consequent.negate(compressor);
                    self.alternative = self.alternative.negate(compressor);
                    return best_of(basic_negation(this), self);
                });
                def(AST_Binary, function (compressor) {
                    var self = this.clone(), op = this.operator;
                    if (compressor.option("unsafe_comps")) {
                        switch (op) {
                            case "<=" :
                                self.operator = ">";
                                return self;
                            case "<"  :
                                self.operator = ">=";
                                return self;
                            case ">=" :
                                self.operator = "<";
                                return self;
                            case ">"  :
                                self.operator = "<=";
                                return self;
                        }
                    }
                    switch (op) {
                        case "==" :
                            self.operator = "!=";
                            return self;
                        case "!=" :
                            self.operator = "==";
                            return self;
                        case "===":
                            self.operator = "!==";
                            return self;
                        case "!==":
                            self.operator = "===";
                            return self;
                        case "&&":
                            self.operator = "||";
                            self.left = self.left.negate(compressor);
                            self.right = self.right.negate(compressor);
                            return best_of(basic_negation(this), self);
                        case "||":
                            self.operator = "&&";
                            self.left = self.left.negate(compressor);
                            self.right = self.right.negate(compressor);
                            return best_of(basic_negation(this), self);
                    }
                    return basic_negation(this);
                });
            })(function (node, func) {
                node.DEFMETHOD("negate", function (compressor) {
                    return func.call(this, compressor);
                });
            });

            // determine if expression has side effects
            (function (def) {
                def(AST_Node, function (compressor) {
                    return true
                });

                def(AST_EmptyStatement, function (compressor) {
                    return false
                });
                def(AST_Constant, function (compressor) {
                    return false
                });
                def(AST_This, function (compressor) {
                    return false
                });

                def(AST_Call, function (compressor) {
                    var pure = compressor.option("pure_funcs");
                    if (!pure) return true;
                    if (typeof pure == "function") return pure(this);
                    return pure.indexOf(this.expression.print_to_string()) < 0;
                });

                def(AST_Block, function (compressor) {
                    for (var i = this.body.length; --i >= 0;) {
                        if (this.body[i].has_side_effects(compressor))
                            return true;
                    }
                    return false;
                });

                def(AST_SimpleStatement, function (compressor) {
                    return this.body.has_side_effects(compressor);
                });
                def(AST_Defun, function (compressor) {
                    return true
                });
                def(AST_Function, function (compressor) {
                    return false
                });
                def(AST_Binary, function (compressor) {
                    return this.left.has_side_effects(compressor)
                        || this.right.has_side_effects(compressor);
                });
                def(AST_Assign, function (compressor) {
                    return true
                });
                def(AST_Conditional, function (compressor) {
                    return this.condition.has_side_effects(compressor)
                        || this.consequent.has_side_effects(compressor)
                        || this.alternative.has_side_effects(compressor);
                });
                def(AST_Unary, function (compressor) {
                    return this.operator == "delete"
                        || this.operator == "++"
                        || this.operator == "--"
                        || this.expression.has_side_effects(compressor);
                });
                def(AST_SymbolRef, function (compressor) {
                    return this.global() && this.undeclared();
                });
                def(AST_Object, function (compressor) {
                    for (var i = this.properties.length; --i >= 0;)
                        if (this.properties[i].has_side_effects(compressor))
                            return true;
                    return false;
                });
                def(AST_ObjectProperty, function (compressor) {
                    return this.value.has_side_effects(compressor);
                });
                def(AST_Array, function (compressor) {
                    for (var i = this.elements.length; --i >= 0;)
                        if (this.elements[i].has_side_effects(compressor))
                            return true;
                    return false;
                });
                def(AST_Dot, function (compressor) {
                    if (!compressor.option("pure_getters")) return true;
                    return this.expression.has_side_effects(compressor);
                });
                def(AST_Sub, function (compressor) {
                    if (!compressor.option("pure_getters")) return true;
                    return this.expression.has_side_effects(compressor)
                        || this.property.has_side_effects(compressor);
                });
                def(AST_PropAccess, function (compressor) {
                    return !compressor.option("pure_getters");
                });
                def(AST_Seq, function (compressor) {
                    return this.car.has_side_effects(compressor)
                        || this.cdr.has_side_effects(compressor);
                });
            })(function (node, func) {
                node.DEFMETHOD("has_side_effects", func);
            });

            // tell me if a statement aborts
            function aborts(thing) {
                return thing && thing.aborts();
            };
            (function (def) {
                def(AST_Statement, function () {
                    return null
                });
                def(AST_Jump, function () {
                    return this
                });

                function block_aborts() {
                    var n = this.body.length;
                    return n > 0 && aborts(this.body[n - 1]);
                };
                def(AST_BlockStatement, block_aborts);
                def(AST_SwitchBranch, block_aborts);
                def(AST_If, function () {
                    return this.alternative && aborts(this.body) && aborts(this.alternative) && this;
                });
            })(function (node, func) {
                node.DEFMETHOD("aborts", func);
            });

            /* -----[ optimizers ]----- */

            OPT(AST_Directive, function (self, compressor) {
                if (compressor.has_directive(self.value) === "up") {
                    return make_node(AST_EmptyStatement, self);
                }
                return self;
            });

            OPT(AST_Debugger, function (self, compressor) {
                if (compressor.option("drop_debugger"))
                    return make_node(AST_EmptyStatement, self);
                return self;
            });

            OPT(AST_LabeledStatement, function (self, compressor) {
                if (self.body instanceof AST_Break
                    && compressor.loopcontrol_target(self.body.label) === self.body) {
                    return make_node(AST_EmptyStatement, self);
                }
                return self.label.references.length == 0 ? self.body : self;
            });

            OPT(AST_Block, function (self, compressor) {
                self.body = tighten_body(self.body, compressor);
                return self;
            });

            OPT(AST_BlockStatement, function (self, compressor) {
                self.body = tighten_body(self.body, compressor);
                switch (self.body.length) {
                    case 1:
                        return self.body[0];
                    case 0:
                        return make_node(AST_EmptyStatement, self);
                }
                return self;
            });

            AST_Scope.DEFMETHOD("drop_unused", function (compressor) {
                var self = this;
                if (compressor.has_directive("use asm")) return self;
                if (compressor.option("unused")
                    && !(self instanceof AST_Toplevel)
                    && !self.uses_eval
                ) {
                    var in_use = [];
                    var initializations = new Dictionary();
                    // pass 1: find out which symbols are directly used in
                    // this scope (not in nested scopes).
                    var scope = this;
                    var tw = new TreeWalker(function (node, descend) {
                        if (node !== self) {
                            if (node instanceof AST_Defun) {
                                initializations.add(node.name.name, node);
                                return true; // don't go in nested scopes
                            }
                            if (node instanceof AST_Definitions && scope === self) {
                                node.definitions.forEach(function (def) {
                                    if (def.value) {
                                        initializations.add(def.name.name, def.value);
                                        if (def.value.has_side_effects(compressor)) {
                                            def.value.walk(tw);
                                        }
                                    }
                                });
                                return true;
                            }
                            if (node instanceof AST_SymbolRef) {
                                push_uniq(in_use, node.definition());
                                return true;
                            }
                            if (node instanceof AST_Scope) {
                                var save_scope = scope;
                                scope = node;
                                descend();
                                scope = save_scope;
                                return true;
                            }
                        }
                    });
                    self.walk(tw);
                    // pass 2: for every used symbol we need to walk its
                    // initialization code to figure out if it uses other
                    // symbols (that may not be in_use).
                    for (var i = 0; i < in_use.length; ++i) {
                        in_use[i].orig.forEach(function (decl) {
                            // undeclared globals will be instanceof AST_SymbolRef
                            var init = initializations.get(decl.name);
                            if (init) init.forEach(function (init) {
                                var tw = new TreeWalker(function (node) {
                                    if (node instanceof AST_SymbolRef) {
                                        push_uniq(in_use, node.definition());
                                    }
                                });
                                init.walk(tw);
                            });
                        });
                    }
                    // pass 3: we should drop declarations not in_use
                    var tt = new TreeTransformer(
                        function before(node, descend, in_list) {
                            if (node instanceof AST_Lambda && !(node instanceof AST_Accessor)) {
                                if (!compressor.option("keep_fargs")) {
                                    for (var a = node.argnames, i = a.length; --i >= 0;) {
                                        var sym = a[i];
                                        if (sym.unreferenced()) {
                                            a.pop();
                                            compressor.warn("Dropping unused function argument {name} [{file}:{line},{col}]", {
                                                name: sym.name,
                                                file: sym.start.file,
                                                line: sym.start.line,
                                                col: sym.start.col
                                            });
                                        } else break;
                                    }
                                }
                            }
                            if (node instanceof AST_Defun && node !== self) {
                                if (!member(node.name.definition(), in_use)) {
                                    compressor.warn("Dropping unused function {name} [{file}:{line},{col}]", {
                                        name: node.name.name,
                                        file: node.name.start.file,
                                        line: node.name.start.line,
                                        col: node.name.start.col
                                    });
                                    return make_node(AST_EmptyStatement, node);
                                }
                                return node;
                            }
                            if (node instanceof AST_Definitions && !(tt.parent() instanceof AST_ForIn)) {
                                var def = node.definitions.filter(function (def) {
                                    if (member(def.name.definition(), in_use)) return true;
                                    var w = {
                                        name: def.name.name,
                                        file: def.name.start.file,
                                        line: def.name.start.line,
                                        col: def.name.start.col
                                    };
                                    if (def.value && def.value.has_side_effects(compressor)) {
                                        def._unused_side_effects = true;
                                        compressor.warn("Side effects in initialization of unused variable {name} [{file}:{line},{col}]", w);
                                        return true;
                                    }
                                    compressor.warn("Dropping unused variable {name} [{file}:{line},{col}]", w);
                                    return false;
                                });
                                // place uninitialized names at the start
                                def = mergeSort(def, function (a, b) {
                                    if (!a.value && b.value) return -1;
                                    if (!b.value && a.value) return 1;
                                    return 0;
                                });
                                // for unused names whose initialization has
                                // side effects, we can cascade the init. code
                                // into the next one, or next statement.
                                var side_effects = [];
                                for (var i = 0; i < def.length;) {
                                    var x = def[i];
                                    if (x._unused_side_effects) {
                                        side_effects.push(x.value);
                                        def.splice(i, 1);
                                    } else {
                                        if (side_effects.length > 0) {
                                            side_effects.push(x.value);
                                            x.value = AST_Seq.from_array(side_effects);
                                            side_effects = [];
                                        }
                                        ++i;
                                    }
                                }
                                if (side_effects.length > 0) {
                                    side_effects = make_node(AST_BlockStatement, node, {
                                        body: [make_node(AST_SimpleStatement, node, {
                                            body: AST_Seq.from_array(side_effects)
                                        })]
                                    });
                                } else {
                                    side_effects = null;
                                }
                                if (def.length == 0 && !side_effects) {
                                    return make_node(AST_EmptyStatement, node);
                                }
                                if (def.length == 0) {
                                    return in_list ? MAP.splice(side_effects.body) : side_effects;
                                }
                                node.definitions = def;
                                if (side_effects) {
                                    side_effects.body.unshift(node);
                                    return in_list ? MAP.splice(side_effects.body) : side_effects;
                                }
                                return node;
                            }
                            if (node instanceof AST_For) {
                                descend(node, this);

                                if (node.init instanceof AST_BlockStatement) {
                                    // certain combination of unused name + side effect leads to:
                                    //    https://github.com/mishoo/UglifyJS2/issues/44
                                    // that's an invalid AST.
                                    // We fix it at this stage by moving the `var` outside the `for`.

                                    var body = node.init.body.slice(0, -1);
                                    node.init = node.init.body.slice(-1)[0].body;
                                    body.push(node);

                                    return in_list ? MAP.splice(body) : make_node(AST_BlockStatement, node, {
                                        body: body
                                    });
                                }
                            }
                            if (node instanceof AST_Scope && node !== self)
                                return node;
                        }
                    );
                    self.transform(tt);
                }
            });

            AST_Scope.DEFMETHOD("hoist_declarations", function (compressor) {
                var self = this;
                if (compressor.has_directive("use asm")) return self;
                var hoist_funs = compressor.option("hoist_funs");
                var hoist_vars = compressor.option("hoist_vars");
                if (hoist_funs || hoist_vars) {
                    var dirs = [];
                    var hoisted = [];
                    var vars = new Dictionary(), vars_found = 0, var_decl = 0;
                    // let's count var_decl first, we seem to waste a lot of
                    // space if we hoist `var` when there's only one.
                    self.walk(new TreeWalker(function (node) {
                        if (node instanceof AST_Scope && node !== self)
                            return true;
                        if (node instanceof AST_Var) {
                            ++var_decl;
                            return true;
                        }
                    }));
                    hoist_vars = hoist_vars && var_decl > 1;
                    var tt = new TreeTransformer(
                        function before(node) {
                            if (node !== self) {
                                if (node instanceof AST_Directive) {
                                    dirs.push(node);
                                    return make_node(AST_EmptyStatement, node);
                                }
                                if (node instanceof AST_Defun && hoist_funs) {
                                    hoisted.push(node);
                                    return make_node(AST_EmptyStatement, node);
                                }
                                if (node instanceof AST_Var && hoist_vars) {
                                    node.definitions.forEach(function (def) {
                                        vars.set(def.name.name, def);
                                        ++vars_found;
                                    });
                                    var seq = node.to_assignments();
                                    var p = tt.parent();
                                    if (p instanceof AST_ForIn && p.init === node) {
                                        if (seq == null) return node.definitions[0].name;
                                        return seq;
                                    }
                                    if (p instanceof AST_For && p.init === node) {
                                        return seq;
                                    }
                                    if (!seq) return make_node(AST_EmptyStatement, node);
                                    return make_node(AST_SimpleStatement, node, {
                                        body: seq
                                    });
                                }
                                if (node instanceof AST_Scope)
                                    return node; // to avoid descending in nested scopes
                            }
                        }
                    );
                    self = self.transform(tt);
                    if (vars_found > 0) {
                        // collect only vars which don't show up in self's arguments list
                        var defs = [];
                        vars.each(function (def, name) {
                            if (self instanceof AST_Lambda
                                && find_if(function (x) {
                                        return x.name == def.name.name
                                    },
                                    self.argnames)) {
                                vars.del(name);
                            } else {
                                def = def.clone();
                                def.value = null;
                                defs.push(def);
                                vars.set(name, def);
                            }
                        });
                        if (defs.length > 0) {
                            // try to merge in assignments
                            for (var i = 0; i < self.body.length;) {
                                if (self.body[i] instanceof AST_SimpleStatement) {
                                    var expr = self.body[i].body, sym, assign;
                                    if (expr instanceof AST_Assign
                                        && expr.operator == "="
                                        && (sym = expr.left) instanceof AST_Symbol
                                        && vars.has(sym.name)) {
                                        var def = vars.get(sym.name);
                                        if (def.value) break;
                                        def.value = expr.right;
                                        remove(defs, def);
                                        defs.push(def);
                                        self.body.splice(i, 1);
                                        continue;
                                    }
                                    if (expr instanceof AST_Seq
                                        && (assign = expr.car) instanceof AST_Assign
                                        && assign.operator == "="
                                        && (sym = assign.left) instanceof AST_Symbol
                                        && vars.has(sym.name)) {
                                        var def = vars.get(sym.name);
                                        if (def.value) break;
                                        def.value = assign.right;
                                        remove(defs, def);
                                        defs.push(def);
                                        self.body[i].body = expr.cdr;
                                        continue;
                                    }
                                }
                                if (self.body[i] instanceof AST_EmptyStatement) {
                                    self.body.splice(i, 1);
                                    continue;
                                }
                                if (self.body[i] instanceof AST_BlockStatement) {
                                    var tmp = [i, 1].concat(self.body[i].body);
                                    self.body.splice.apply(self.body, tmp);
                                    continue;
                                }
                                break;
                            }
                            defs = make_node(AST_Var, self, {
                                definitions: defs
                            });
                            hoisted.push(defs);
                        }
                        ;
                    }
                    self.body = dirs.concat(hoisted, self.body);
                }
                return self;
            });

            OPT(AST_SimpleStatement, function (self, compressor) {
                if (compressor.option("side_effects")) {
                    if (!self.body.has_side_effects(compressor)) {
                        compressor.warn("Dropping side-effect-free statement [{file}:{line},{col}]", self.start);
                        return make_node(AST_EmptyStatement, self);
                    }
                }
                return self;
            });

            OPT(AST_DWLoop, function (self, compressor) {
                var cond = self.condition.evaluate(compressor);
                self.condition = cond[0];
                if (!compressor.option("loops")) return self;
                if (cond.length > 1) {
                    if (cond[1]) {
                        return make_node(AST_For, self, {
                            body: self.body
                        });
                    } else if (self instanceof AST_While) {
                        if (compressor.option("dead_code")) {
                            var a = [];
                            extract_declarations_from_unreachable_code(compressor, self.body, a);
                            return make_node(AST_BlockStatement, self, {body: a});
                        }
                    }
                }
                return self;
            });

            function if_break_in_loop(self, compressor) {
                function drop_it(rest) {
                    rest = as_statement_array(rest);
                    if (self.body instanceof AST_BlockStatement) {
                        self.body = self.body.clone();
                        self.body.body = rest.concat(self.body.body.slice(1));
                        self.body = self.body.transform(compressor);
                    } else {
                        self.body = make_node(AST_BlockStatement, self.body, {
                            body: rest
                        }).transform(compressor);
                    }
                    if_break_in_loop(self, compressor);
                }

                var first = self.body instanceof AST_BlockStatement ? self.body.body[0] : self.body;
                if (first instanceof AST_If) {
                    if (first.body instanceof AST_Break
                        && compressor.loopcontrol_target(first.body.label) === self) {
                        if (self.condition) {
                            self.condition = make_node(AST_Binary, self.condition, {
                                left: self.condition,
                                operator: "&&",
                                right: first.condition.negate(compressor),
                            });
                        } else {
                            self.condition = first.condition.negate(compressor);
                        }
                        drop_it(first.alternative);
                    } else if (first.alternative instanceof AST_Break
                        && compressor.loopcontrol_target(first.alternative.label) === self) {
                        if (self.condition) {
                            self.condition = make_node(AST_Binary, self.condition, {
                                left: self.condition,
                                operator: "&&",
                                right: first.condition,
                            });
                        } else {
                            self.condition = first.condition;
                        }
                        drop_it(first.body);
                    }
                }
            };

            OPT(AST_While, function (self, compressor) {
                if (!compressor.option("loops")) return self;
                self = AST_DWLoop.prototype.optimize.call(self, compressor);
                if (self instanceof AST_While) {
                    if_break_in_loop(self, compressor);
                    self = make_node(AST_For, self, self).transform(compressor);
                }
                return self;
            });

            OPT(AST_For, function (self, compressor) {
                var cond = self.condition;
                if (cond) {
                    cond = cond.evaluate(compressor);
                    self.condition = cond[0];
                }
                if (!compressor.option("loops")) return self;
                if (cond) {
                    if (cond.length > 1 && !cond[1]) {
                        if (compressor.option("dead_code")) {
                            var a = [];
                            if (self.init instanceof AST_Statement) {
                                a.push(self.init);
                            } else if (self.init) {
                                a.push(make_node(AST_SimpleStatement, self.init, {
                                    body: self.init
                                }));
                            }
                            extract_declarations_from_unreachable_code(compressor, self.body, a);
                            return make_node(AST_BlockStatement, self, {body: a});
                        }
                    }
                }
                if_break_in_loop(self, compressor);
                return self;
            });

            OPT(AST_If, function (self, compressor) {
                if (!compressor.option("conditionals")) return self;
                // if condition can be statically determined, warn and drop
                // one of the blocks.  note, statically determined implies
                // “has no side effects”; also it doesn't work for cases like
                // `x && true`, though it probably should.
                var cond = self.condition.evaluate(compressor);
                self.condition = cond[0];
                if (cond.length > 1) {
                    if (cond[1]) {
                        compressor.warn("Condition always true [{file}:{line},{col}]", self.condition.start);
                        if (compressor.option("dead_code")) {
                            var a = [];
                            if (self.alternative) {
                                extract_declarations_from_unreachable_code(compressor, self.alternative, a);
                            }
                            a.push(self.body);
                            return make_node(AST_BlockStatement, self, {body: a}).transform(compressor);
                        }
                    } else {
                        compressor.warn("Condition always false [{file}:{line},{col}]", self.condition.start);
                        if (compressor.option("dead_code")) {
                            var a = [];
                            extract_declarations_from_unreachable_code(compressor, self.body, a);
                            if (self.alternative) a.push(self.alternative);
                            return make_node(AST_BlockStatement, self, {body: a}).transform(compressor);
                        }
                    }
                }
                if (is_empty(self.alternative)) self.alternative = null;
                var negated = self.condition.negate(compressor);
                var negated_is_best = best_of(self.condition, negated) === negated;
                if (self.alternative && negated_is_best) {
                    negated_is_best = false; // because we already do the switch here.
                    self.condition = negated;
                    var tmp = self.body;
                    self.body = self.alternative || make_node(AST_EmptyStatement);
                    self.alternative = tmp;
                }
                if (is_empty(self.body) && is_empty(self.alternative)) {
                    return make_node(AST_SimpleStatement, self.condition, {
                        body: self.condition
                    }).transform(compressor);
                }
                if (self.body instanceof AST_SimpleStatement
                    && self.alternative instanceof AST_SimpleStatement) {
                    return make_node(AST_SimpleStatement, self, {
                        body: make_node(AST_Conditional, self, {
                            condition: self.condition,
                            consequent: self.body.body,
                            alternative: self.alternative.body
                        })
                    }).transform(compressor);
                }
                if (is_empty(self.alternative) && self.body instanceof AST_SimpleStatement) {
                    if (negated_is_best) return make_node(AST_SimpleStatement, self, {
                        body: make_node(AST_Binary, self, {
                            operator: "||",
                            left: negated,
                            right: self.body.body
                        })
                    }).transform(compressor);
                    return make_node(AST_SimpleStatement, self, {
                        body: make_node(AST_Binary, self, {
                            operator: "&&",
                            left: self.condition,
                            right: self.body.body
                        })
                    }).transform(compressor);
                }
                if (self.body instanceof AST_EmptyStatement
                    && self.alternative
                    && self.alternative instanceof AST_SimpleStatement) {
                    return make_node(AST_SimpleStatement, self, {
                        body: make_node(AST_Binary, self, {
                            operator: "||",
                            left: self.condition,
                            right: self.alternative.body
                        })
                    }).transform(compressor);
                }
                if (self.body instanceof AST_Exit
                    && self.alternative instanceof AST_Exit
                    && self.body.TYPE == self.alternative.TYPE) {
                    return make_node(self.body.CTOR, self, {
                        value: make_node(AST_Conditional, self, {
                            condition: self.condition,
                            consequent: self.body.value || make_node(AST_Undefined, self.body).optimize(compressor),
                            alternative: self.alternative.value || make_node(AST_Undefined, self.alternative).optimize(compressor)
                        })
                    }).transform(compressor);
                }
                if (self.body instanceof AST_If
                    && !self.body.alternative
                    && !self.alternative) {
                    self.condition = make_node(AST_Binary, self.condition, {
                        operator: "&&",
                        left: self.condition,
                        right: self.body.condition
                    }).transform(compressor);
                    self.body = self.body.body;
                }
                if (aborts(self.body)) {
                    if (self.alternative) {
                        var alt = self.alternative;
                        self.alternative = null;
                        return make_node(AST_BlockStatement, self, {
                            body: [self, alt]
                        }).transform(compressor);
                    }
                }
                if (aborts(self.alternative)) {
                    var body = self.body;
                    self.body = self.alternative;
                    self.condition = negated_is_best ? negated : self.condition.negate(compressor);
                    self.alternative = null;
                    return make_node(AST_BlockStatement, self, {
                        body: [self, body]
                    }).transform(compressor);
                }
                return self;
            });

            OPT(AST_Switch, function (self, compressor) {
                if (self.body.length == 0 && compressor.option("conditionals")) {
                    return make_node(AST_SimpleStatement, self, {
                        body: self.expression
                    }).transform(compressor);
                }
                for (; ;) {
                    var last_branch = self.body[self.body.length - 1];
                    if (last_branch) {
                        var stat = last_branch.body[last_branch.body.length - 1]; // last statement
                        if (stat instanceof AST_Break && loop_body(compressor.loopcontrol_target(stat.label)) === self)
                            last_branch.body.pop();
                        if (last_branch instanceof AST_Default && last_branch.body.length == 0) {
                            self.body.pop();
                            continue;
                        }
                    }
                    break;
                }
                var exp = self.expression.evaluate(compressor);
                out: if (exp.length == 2) try {
                    // constant expression
                    self.expression = exp[0];
                    if (!compressor.option("dead_code")) break out;
                    var value = exp[1];
                    var in_if = false;
                    var in_block = false;
                    var started = false;
                    var stopped = false;
                    var ruined = false;
                    var tt = new TreeTransformer(function (node, descend, in_list) {
                        if (node instanceof AST_Lambda || node instanceof AST_SimpleStatement) {
                            // no need to descend these node types
                            return node;
                        } else if (node instanceof AST_Switch && node === self) {
                            node = node.clone();
                            descend(node, this);
                            return ruined ? node : make_node(AST_BlockStatement, node, {
                                body: node.body.reduce(function (a, branch) {
                                    return a.concat(branch.body);
                                }, [])
                            }).transform(compressor);
                        } else if (node instanceof AST_If || node instanceof AST_Try) {
                            var save = in_if;
                            in_if = !in_block;
                            descend(node, this);
                            in_if = save;
                            return node;
                        } else if (node instanceof AST_StatementWithBody || node instanceof AST_Switch) {
                            var save = in_block;
                            in_block = true;
                            descend(node, this);
                            in_block = save;
                            return node;
                        } else if (node instanceof AST_Break && this.loopcontrol_target(node.label) === self) {
                            if (in_if) {
                                ruined = true;
                                return node;
                            }
                            if (in_block) return node;
                            stopped = true;
                            return in_list ? MAP.skip : make_node(AST_EmptyStatement, node);
                        } else if (node instanceof AST_SwitchBranch && this.parent() === self) {
                            if (stopped) return MAP.skip;
                            if (node instanceof AST_Case) {
                                var exp = node.expression.evaluate(compressor);
                                if (exp.length < 2) {
                                    // got a case with non-constant expression, baling out
                                    throw self;
                                }
                                if (exp[1] === value || started) {
                                    started = true;
                                    if (aborts(node)) stopped = true;
                                    descend(node, this);
                                    return node;
                                }
                                return MAP.skip;
                            }
                            descend(node, this);
                            return node;
                        }
                    });
                    tt.stack = compressor.stack.slice(); // so that's able to see parent nodes
                    self = self.transform(tt);
                } catch (ex) {
                    if (ex !== self) throw ex;
                }
                return self;
            });

            OPT(AST_Case, function (self, compressor) {
                self.body = tighten_body(self.body, compressor);
                return self;
            });

            OPT(AST_Try, function (self, compressor) {
                self.body = tighten_body(self.body, compressor);
                return self;
            });

            AST_Definitions.DEFMETHOD("remove_initializers", function () {
                this.definitions.forEach(function (def) {
                    def.value = null
                });
            });

            AST_Definitions.DEFMETHOD("to_assignments", function () {
                var assignments = this.definitions.reduce(function (a, def) {
                    if (def.value) {
                        var name = make_node(AST_SymbolRef, def.name, def.name);
                        a.push(make_node(AST_Assign, def, {
                            operator: "=",
                            left: name,
                            right: def.value
                        }));
                    }
                    return a;
                }, []);
                if (assignments.length == 0) return null;
                return AST_Seq.from_array(assignments);
            });

            OPT(AST_Definitions, function (self, compressor) {
                if (self.definitions.length == 0)
                    return make_node(AST_EmptyStatement, self);
                return self;
            });

            OPT(AST_Function, function (self, compressor) {
                self = AST_Lambda.prototype.optimize.call(self, compressor);
                if (compressor.option("unused") && !compressor.option("keep_fnames")) {
                    if (self.name && self.name.unreferenced()) {
                        self.name = null;
                    }
                }
                return self;
            });

            OPT(AST_Call, function (self, compressor) {
                if (compressor.option("unsafe")) {
                    var exp = self.expression;
                    if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                        switch (exp.name) {
                            case "Array":
                                if (self.args.length != 1) {
                                    return make_node(AST_Array, self, {
                                        elements: self.args
                                    }).transform(compressor);
                                }
                                break;
                            case "Object":
                                if (self.args.length == 0) {
                                    return make_node(AST_Object, self, {
                                        properties: []
                                    });
                                }
                                break;
                            case "String":
                                if (self.args.length == 0) return make_node(AST_String, self, {
                                    value: ""
                                });
                                if (self.args.length <= 1) return make_node(AST_Binary, self, {
                                    left: self.args[0],
                                    operator: "+",
                                    right: make_node(AST_String, self, {value: ""})
                                }).transform(compressor);
                                break;
                            case "Number":
                                if (self.args.length == 0) return make_node(AST_Number, self, {
                                    value: 0
                                });
                                if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                                    expression: self.args[0],
                                    operator: "+"
                                }).transform(compressor);
                            case "Boolean":
                                if (self.args.length == 0) return make_node(AST_False, self);
                                if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                                    expression: make_node(AST_UnaryPrefix, null, {
                                        expression: self.args[0],
                                        operator: "!"
                                    }),
                                    operator: "!"
                                }).transform(compressor);
                                break;
                            case "Function":
                                // new Function() => function(){}
                                if (self.args.length == 0) return make_node(AST_Function, self, {
                                    argnames: [],
                                    body: []
                                });
                                if (all(self.args, function (x) {
                                    return x instanceof AST_String
                                })) {
                                    // quite a corner-case, but we can handle it:
                                    //   https://github.com/mishoo/UglifyJS2/issues/203
                                    // if the code argument is a constant, then we can minify it.
                                    try {
                                        var code = "(function(" + self.args.slice(0, -1).map(function (arg) {
                                            return arg.value;
                                        }).join(",") + "){" + self.args[self.args.length - 1].value + "})()";
                                        var ast = parse(code);
                                        ast.figure_out_scope({screw_ie8: compressor.option("screw_ie8")});
                                        var comp = new Compressor(compressor.options);
                                        ast = ast.transform(comp);
                                        ast.figure_out_scope({screw_ie8: compressor.option("screw_ie8")});
                                        ast.mangle_names();
                                        var fun;
                                        try {
                                            ast.walk(new TreeWalker(function (node) {
                                                if (node instanceof AST_Lambda) {
                                                    fun = node;
                                                    throw ast;
                                                }
                                            }));
                                        } catch (ex) {
                                            if (ex !== ast) throw ex;
                                        }
                                        ;
                                        if (!fun) return self;
                                        var args = fun.argnames.map(function (arg, i) {
                                            return make_node(AST_String, self.args[i], {
                                                value: arg.print_to_string()
                                            });
                                        });
                                        var code = OutputStream();
                                        AST_BlockStatement.prototype._codegen.call(fun, fun, code);
                                        code = code.toString().replace(/^\{|\}$/g, "");
                                        args.push(make_node(AST_String, self.args[self.args.length - 1], {
                                            value: code
                                        }));
                                        self.args = args;
                                        return self;
                                    } catch (ex) {
                                        if (ex instanceof JS_Parse_Error) {
                                            compressor.warn("Error parsing code passed to new Function [{file}:{line},{col}]", self.args[self.args.length - 1].start);
                                            compressor.warn(ex.toString());
                                        } else {
                                            console.log(ex);
                                            throw ex;
                                        }
                                    }
                                }
                                break;
                        }
                    } else if (exp instanceof AST_Dot && exp.property == "toString" && self.args.length == 0) {
                        return make_node(AST_Binary, self, {
                            left: make_node(AST_String, self, {value: ""}),
                            operator: "+",
                            right: exp.expression
                        }).transform(compressor);
                    } else if (exp instanceof AST_Dot && exp.expression instanceof AST_Array && exp.property == "join") EXIT: {
                        var separator = self.args.length == 0 ? "," : self.args[0].evaluate(compressor)[1];
                        if (separator == null) break EXIT; // not a constant
                        var elements = exp.expression.elements.reduce(function (a, el) {
                            el = el.evaluate(compressor);
                            if (a.length == 0 || el.length == 1) {
                                a.push(el);
                            } else {
                                var last = a[a.length - 1];
                                if (last.length == 2) {
                                    // it's a constant
                                    var val = "" + last[1] + separator + el[1];
                                    a[a.length - 1] = [make_node_from_constant(compressor, val, last[0]), val];
                                } else {
                                    a.push(el);
                                }
                            }
                            return a;
                        }, []);
                        if (elements.length == 0) return make_node(AST_String, self, {value: ""});
                        if (elements.length == 1) return elements[0][0];
                        if (separator == "") {
                            var first;
                            if (elements[0][0] instanceof AST_String
                                || elements[1][0] instanceof AST_String) {
                                first = elements.shift()[0];
                            } else {
                                first = make_node(AST_String, self, {value: ""});
                            }
                            return elements.reduce(function (prev, el) {
                                return make_node(AST_Binary, el[0], {
                                    operator: "+",
                                    left: prev,
                                    right: el[0],
                                });
                            }, first).transform(compressor);
                        }
                        // need this awkward cloning to not affect original element
                        // best_of will decide which one to get through.
                        var node = self.clone();
                        node.expression = node.expression.clone();
                        node.expression.expression = node.expression.expression.clone();
                        node.expression.expression.elements = elements.map(function (el) {
                            return el[0];
                        });
                        return best_of(self, node);
                    }
                }
                if (compressor.option("side_effects")) {
                    if (self.expression instanceof AST_Function
                        && self.args.length == 0
                        && !AST_Block.prototype.has_side_effects.call(self.expression, compressor)) {
                        return make_node(AST_Undefined, self).transform(compressor);
                    }
                }
                if (compressor.option("drop_console")) {
                    if (self.expression instanceof AST_PropAccess) {
                        var name = self.expression.expression;
                        while (name.expression) {
                            name = name.expression;
                        }
                        if (name instanceof AST_SymbolRef
                            && name.name == "console"
                            && name.undeclared()) {
                            return make_node(AST_Undefined, self).transform(compressor);
                        }
                    }
                }
                return self.evaluate(compressor)[0];
            });

            OPT(AST_New, function (self, compressor) {
                if (compressor.option("unsafe")) {
                    var exp = self.expression;
                    if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                        switch (exp.name) {
                            case "Object":
                            case "RegExp":
                            case "Function":
                            case "Error":
                            case "Array":
                                return make_node(AST_Call, self, self).transform(compressor);
                        }
                    }
                }
                return self;
            });

            OPT(AST_Seq, function (self, compressor) {
                if (!compressor.option("side_effects"))
                    return self;
                if (!self.car.has_side_effects(compressor)) {
                    // we shouldn't compress (1,func)(something) to
                    // func(something) because that changes the meaning of
                    // the func (becomes lexical instead of global).
                    var p = compressor.parent();
                    if (!(p instanceof AST_Call && p.expression === self)) {
                        return self.cdr;
                    }
                }
                if (compressor.option("cascade")) {
                    if (self.car instanceof AST_Assign
                        && !self.car.left.has_side_effects(compressor)) {
                        if (self.car.left.equivalent_to(self.cdr)) {
                            return self.car;
                        }
                        if (self.cdr instanceof AST_Call
                            && self.cdr.expression.equivalent_to(self.car.left)) {
                            self.cdr.expression = self.car;
                            return self.cdr;
                        }
                    }
                    if (!self.car.has_side_effects(compressor)
                        && !self.cdr.has_side_effects(compressor)
                        && self.car.equivalent_to(self.cdr)) {
                        return self.car;
                    }
                }
                if (self.cdr instanceof AST_UnaryPrefix
                    && self.cdr.operator == "void"
                    && !self.cdr.expression.has_side_effects(compressor)) {
                    self.cdr.expression = self.car;
                    return self.cdr;
                }
                if (self.cdr instanceof AST_Undefined) {
                    return make_node(AST_UnaryPrefix, self, {
                        operator: "void",
                        expression: self.car
                    });
                }
                return self;
            });

            AST_Unary.DEFMETHOD("lift_sequences", function (compressor) {
                if (compressor.option("sequences")) {
                    if (this.expression instanceof AST_Seq) {
                        var seq = this.expression;
                        var x = seq.to_array();
                        this.expression = x.pop();
                        x.push(this);
                        seq = AST_Seq.from_array(x).transform(compressor);
                        return seq;
                    }
                }
                return this;
            });

            OPT(AST_UnaryPostfix, function (self, compressor) {
                return self.lift_sequences(compressor);
            });

            OPT(AST_UnaryPrefix, function (self, compressor) {
                self = self.lift_sequences(compressor);
                var e = self.expression;
                if (compressor.option("booleans") && compressor.in_boolean_context()) {
                    switch (self.operator) {
                        case "!":
                            if (e instanceof AST_UnaryPrefix && e.operator == "!") {
                                // !!foo ==> foo, if we're in boolean context
                                return e.expression;
                            }
                            break;
                        case "typeof":
                            // typeof always returns a non-empty string, thus it's
                            // always true in booleans
                            compressor.warn("Boolean expression always true [{file}:{line},{col}]", self.start);
                            return make_node(AST_True, self);
                    }
                    if (e instanceof AST_Binary && self.operator == "!") {
                        self = best_of(self, e.negate(compressor));
                    }
                }
                return self.evaluate(compressor)[0];
            });

            function has_side_effects_or_prop_access(node, compressor) {
                var save_pure_getters = compressor.option("pure_getters");
                compressor.options.pure_getters = false;
                var ret = node.has_side_effects(compressor);
                compressor.options.pure_getters = save_pure_getters;
                return ret;
            }

            AST_Binary.DEFMETHOD("lift_sequences", function (compressor) {
                if (compressor.option("sequences")) {
                    if (this.left instanceof AST_Seq) {
                        var seq = this.left;
                        var x = seq.to_array();
                        this.left = x.pop();
                        x.push(this);
                        seq = AST_Seq.from_array(x).transform(compressor);
                        return seq;
                    }
                    if (this.right instanceof AST_Seq
                        && this instanceof AST_Assign
                        && !has_side_effects_or_prop_access(this.left, compressor)) {
                        var seq = this.right;
                        var x = seq.to_array();
                        this.right = x.pop();
                        x.push(this);
                        seq = AST_Seq.from_array(x).transform(compressor);
                        return seq;
                    }
                }
                return this;
            });

            var commutativeOperators = makePredicate("== === != !== * & | ^");

            OPT(AST_Binary, function (self, compressor) {
                function reverse(op, force) {
                    if (force || !(self.left.has_side_effects(compressor) || self.right.has_side_effects(compressor))) {
                        if (op) self.operator = op;
                        var tmp = self.left;
                        self.left = self.right;
                        self.right = tmp;
                    }
                }

                if (commutativeOperators(self.operator)) {
                    if (self.right instanceof AST_Constant
                        && !(self.left instanceof AST_Constant)) {
                        // if right is a constant, whatever side effects the
                        // left side might have could not influence the
                        // result.  hence, force switch.

                        if (!(self.left instanceof AST_Binary
                            && PRECEDENCE[self.left.operator] >= PRECEDENCE[self.operator])) {
                            reverse(null, true);
                        }
                    }
                    if (/^[!=]==?$/.test(self.operator)) {
                        if (self.left instanceof AST_SymbolRef && self.right instanceof AST_Conditional) {
                            if (self.right.consequent instanceof AST_SymbolRef
                                && self.right.consequent.definition() === self.left.definition()) {
                                if (/^==/.test(self.operator)) return self.right.condition;
                                if (/^!=/.test(self.operator)) return self.right.condition.negate(compressor);
                            }
                            if (self.right.alternative instanceof AST_SymbolRef
                                && self.right.alternative.definition() === self.left.definition()) {
                                if (/^==/.test(self.operator)) return self.right.condition.negate(compressor);
                                if (/^!=/.test(self.operator)) return self.right.condition;
                            }
                        }
                        if (self.right instanceof AST_SymbolRef && self.left instanceof AST_Conditional) {
                            if (self.left.consequent instanceof AST_SymbolRef
                                && self.left.consequent.definition() === self.right.definition()) {
                                if (/^==/.test(self.operator)) return self.left.condition;
                                if (/^!=/.test(self.operator)) return self.left.condition.negate(compressor);
                            }
                            if (self.left.alternative instanceof AST_SymbolRef
                                && self.left.alternative.definition() === self.right.definition()) {
                                if (/^==/.test(self.operator)) return self.left.condition.negate(compressor);
                                if (/^!=/.test(self.operator)) return self.left.condition;
                            }
                        }
                    }
                }
                self = self.lift_sequences(compressor);
                if (compressor.option("comparisons")) switch (self.operator) {
                    case "===":
                    case "!==":
                        if ((self.left.is_string(compressor) && self.right.is_string(compressor)) ||
                            (self.left.is_boolean() && self.right.is_boolean())) {
                            self.operator = self.operator.substr(0, 2);
                        }
                    // XXX: intentionally falling down to the next case
                    case "==":
                    case "!=":
                        if (self.left instanceof AST_String
                            && self.left.value == "undefined"
                            && self.right instanceof AST_UnaryPrefix
                            && self.right.operator == "typeof"
                            && compressor.option("unsafe")) {
                            if (!(self.right.expression instanceof AST_SymbolRef)
                                || !self.right.expression.undeclared()) {
                                self.right = self.right.expression;
                                self.left = make_node(AST_Undefined, self.left).optimize(compressor);
                                if (self.operator.length == 2) self.operator += "=";
                            }
                        }
                        break;
                }
                if (compressor.option("conditionals")) {
                    if (self.operator == "&&") {
                        var ll = self.left.evaluate(compressor);
                        if (ll.length > 1) {
                            if (ll[1]) {
                                compressor.warn("Condition left of && always true [{file}:{line},{col}]", self.start);
                                var rr = self.right.evaluate(compressor);
                                return rr[0];
                            } else {
                                compressor.warn("Condition left of && always false [{file}:{line},{col}]", self.start);
                                return ll[0];
                            }
                        }
                    } else if (self.operator == "||") {
                        var ll = self.left.evaluate(compressor);
                        if (ll.length > 1) {
                            if (ll[1]) {
                                compressor.warn("Condition left of || always true [{file}:{line},{col}]", self.start);
                                return ll[0];
                            } else {
                                compressor.warn("Condition left of || always false [{file}:{line},{col}]", self.start);
                                var rr = self.right.evaluate(compressor);
                                return rr[0];
                            }
                        }
                    }
                }
                if (compressor.option("booleans") && compressor.in_boolean_context()) switch (self.operator) {
                    case "&&":
                        var ll = self.left.evaluate(compressor);
                        var rr = self.right.evaluate(compressor);
                        if ((ll.length > 1 && !ll[1]) || (rr.length > 1 && !rr[1])) {
                            compressor.warn("Boolean && always false [{file}:{line},{col}]", self.start);
                            if (self.left.has_side_effects(compressor)) {
                                return make_node(AST_Seq, self, {
                                    car: self.left,
                                    cdr: make_node(AST_False)
                                }).optimize(compressor);
                            }
                            return make_node(AST_False, self);
                        }
                        if (ll.length > 1 && ll[1]) {
                            return rr[0];
                        }
                        if (rr.length > 1 && rr[1]) {
                            return ll[0];
                        }
                        break;
                    case "||":
                        var ll = self.left.evaluate(compressor);
                        var rr = self.right.evaluate(compressor);
                        if ((ll.length > 1 && ll[1]) || (rr.length > 1 && rr[1])) {
                            compressor.warn("Boolean || always true [{file}:{line},{col}]", self.start);
                            if (self.left.has_side_effects(compressor)) {
                                return make_node(AST_Seq, self, {
                                    car: self.left,
                                    cdr: make_node(AST_True)
                                }).optimize(compressor);
                            }
                            return make_node(AST_True, self);
                        }
                        if (ll.length > 1 && !ll[1]) {
                            return rr[0];
                        }
                        if (rr.length > 1 && !rr[1]) {
                            return ll[0];
                        }
                        break;
                    case "+":
                        var ll = self.left.evaluate(compressor);
                        var rr = self.right.evaluate(compressor);
                        if ((ll.length > 1 && ll[0] instanceof AST_String && ll[1]) ||
                            (rr.length > 1 && rr[0] instanceof AST_String && rr[1])) {
                            compressor.warn("+ in boolean context always true [{file}:{line},{col}]", self.start);
                            return make_node(AST_True, self);
                        }
                        break;
                }
                if (compressor.option("comparisons") && self.is_boolean()) {
                    if (!(compressor.parent() instanceof AST_Binary)
                        || compressor.parent() instanceof AST_Assign) {
                        var negated = make_node(AST_UnaryPrefix, self, {
                            operator: "!",
                            expression: self.negate(compressor)
                        });
                        self = best_of(self, negated);
                    }
                    switch (self.operator) {
                        case "<":
                            reverse(">");
                            break;
                        case "<=":
                            reverse(">=");
                            break;
                    }
                }
                if (self.operator == "+" && self.right instanceof AST_String
                    && self.right.getValue() === "" && self.left instanceof AST_Binary
                    && self.left.operator == "+" && self.left.is_string(compressor)) {
                    return self.left;
                }
                if (compressor.option("evaluate")) {
                    if (self.operator == "+") {
                        if (self.left instanceof AST_Constant
                            && self.right instanceof AST_Binary
                            && self.right.operator == "+"
                            && self.right.left instanceof AST_Constant
                            && self.right.is_string(compressor)) {
                            self = make_node(AST_Binary, self, {
                                operator: "+",
                                left: make_node(AST_String, null, {
                                    value: "" + self.left.getValue() + self.right.left.getValue(),
                                    start: self.left.start,
                                    end: self.right.left.end
                                }),
                                right: self.right.right
                            });
                        }
                        if (self.right instanceof AST_Constant
                            && self.left instanceof AST_Binary
                            && self.left.operator == "+"
                            && self.left.right instanceof AST_Constant
                            && self.left.is_string(compressor)) {
                            self = make_node(AST_Binary, self, {
                                operator: "+",
                                left: self.left.left,
                                right: make_node(AST_String, null, {
                                    value: "" + self.left.right.getValue() + self.right.getValue(),
                                    start: self.left.right.start,
                                    end: self.right.end
                                })
                            });
                        }
                        if (self.left instanceof AST_Binary
                            && self.left.operator == "+"
                            && self.left.is_string(compressor)
                            && self.left.right instanceof AST_Constant
                            && self.right instanceof AST_Binary
                            && self.right.operator == "+"
                            && self.right.left instanceof AST_Constant
                            && self.right.is_string(compressor)) {
                            self = make_node(AST_Binary, self, {
                                operator: "+",
                                left: make_node(AST_Binary, self.left, {
                                    operator: "+",
                                    left: self.left.left,
                                    right: make_node(AST_String, null, {
                                        value: "" + self.left.right.getValue() + self.right.left.getValue(),
                                        start: self.left.right.start,
                                        end: self.right.left.end
                                    })
                                }),
                                right: self.right.right
                            });
                        }
                    }
                }
                // x && (y && z)  ==>  x && y && z
                // x || (y || z)  ==>  x || y || z
                if (self.right instanceof AST_Binary
                    && self.right.operator == self.operator
                    && (self.operator == "&&" || self.operator == "||")) {
                    self.left = make_node(AST_Binary, self.left, {
                        operator: self.operator,
                        left: self.left,
                        right: self.right.left
                    });
                    self.right = self.right.right;
                    return self.transform(compressor);
                }
                return self.evaluate(compressor)[0];
            });

            OPT(AST_SymbolRef, function (self, compressor) {
                function isLHS(symbol, parent) {
                    return (
                        parent instanceof AST_Binary &&
                        parent.operator === '=' &&
                        parent.left === symbol
                    );
                }

                if (self.undeclared() && !isLHS(self, compressor.parent())) {
                    var defines = compressor.option("global_defs");
                    if (defines && defines.hasOwnProperty(self.name)) {
                        return make_node_from_constant(compressor, defines[self.name], self);
                    }
                    switch (self.name) {
                        case "undefined":
                            return make_node(AST_Undefined, self);
                        case "NaN":
                            return make_node(AST_NaN, self).transform(compressor);
                        case "Infinity":
                            return make_node(AST_Infinity, self).transform(compressor);
                    }
                }
                return self;
            });

            OPT(AST_Infinity, function (self, compressor) {
                return make_node(AST_Binary, self, {
                    operator: '/',
                    left: make_node(AST_Number, self, {value: 1}),
                    right: make_node(AST_Number, self, {value: 0})
                });
            });

            OPT(AST_Undefined, function (self, compressor) {
                if (compressor.option("unsafe")) {
                    var scope = compressor.find_parent(AST_Scope);
                    var undef = scope.find_variable("undefined");
                    if (undef) {
                        var ref = make_node(AST_SymbolRef, self, {
                            name: "undefined",
                            scope: scope,
                            thedef: undef
                        });
                        ref.reference();
                        return ref;
                    }
                }
                return self;
            });

            var ASSIGN_OPS = ['+', '-', '/', '*', '%', '>>', '<<', '>>>', '|', '^', '&'];
            OPT(AST_Assign, function (self, compressor) {
                self = self.lift_sequences(compressor);
                if (self.operator == "="
                    && self.left instanceof AST_SymbolRef
                    && self.right instanceof AST_Binary
                    && self.right.left instanceof AST_SymbolRef
                    && self.right.left.name == self.left.name
                    && member(self.right.operator, ASSIGN_OPS)) {
                    self.operator = self.right.operator + "=";
                    self.right = self.right.right;
                }
                return self;
            });

            OPT(AST_Conditional, function (self, compressor) {
                if (!compressor.option("conditionals")) return self;
                if (self.condition instanceof AST_Seq) {
                    var car = self.condition.car;
                    self.condition = self.condition.cdr;
                    return AST_Seq.cons(car, self);
                }
                var cond = self.condition.evaluate(compressor);
                if (cond.length > 1) {
                    if (cond[1]) {
                        compressor.warn("Condition always true [{file}:{line},{col}]", self.start);
                        return self.consequent;
                    } else {
                        compressor.warn("Condition always false [{file}:{line},{col}]", self.start);
                        return self.alternative;
                    }
                }
                var negated = cond[0].negate(compressor);
                if (best_of(cond[0], negated) === negated) {
                    self = make_node(AST_Conditional, self, {
                        condition: negated,
                        consequent: self.alternative,
                        alternative: self.consequent
                    });
                }
                var consequent = self.consequent;
                var alternative = self.alternative;
                if (consequent instanceof AST_Assign
                    && alternative instanceof AST_Assign
                    && consequent.operator == alternative.operator
                    && consequent.left.equivalent_to(alternative.left)
                    && !consequent.left.has_side_effects(compressor)
                ) {
                    /*
             * Stuff like this:
             * if (foo) exp = something; else exp = something_else;
             * ==>
             * exp = foo ? something : something_else;
             */
                    return make_node(AST_Assign, self, {
                        operator: consequent.operator,
                        left: consequent.left,
                        right: make_node(AST_Conditional, self, {
                            condition: self.condition,
                            consequent: consequent.right,
                            alternative: alternative.right
                        })
                    });
                }
                if (consequent instanceof AST_Call
                    && alternative.TYPE === consequent.TYPE
                    && consequent.args.length == alternative.args.length
                    && !consequent.expression.has_side_effects(compressor)
                    && consequent.expression.equivalent_to(alternative.expression)) {
                    if (consequent.args.length == 0) {
                        return make_node(AST_Seq, self, {
                            car: self.condition,
                            cdr: consequent
                        });
                    }
                    if (consequent.args.length == 1) {
                        consequent.args[0] = make_node(AST_Conditional, self, {
                            condition: self.condition,
                            consequent: consequent.args[0],
                            alternative: alternative.args[0]
                        });
                        return consequent;
                    }
                }
                // x?y?z:a:a --> x&&y?z:a
                if (consequent instanceof AST_Conditional
                    && consequent.alternative.equivalent_to(alternative)) {
                    return make_node(AST_Conditional, self, {
                        condition: make_node(AST_Binary, self, {
                            left: self.condition,
                            operator: "&&",
                            right: consequent.condition
                        }),
                        consequent: consequent.consequent,
                        alternative: alternative
                    });
                }
                // x=y?1:1 --> x=1
                if (consequent instanceof AST_Constant
                    && alternative instanceof AST_Constant
                    && consequent.equivalent_to(alternative)) {
                    if (self.condition.has_side_effects(compressor)) {
                        return AST_Seq.from_array([self.condition, make_node_from_constant(compressor, consequent.value, self)]);
                    } else {
                        return make_node_from_constant(compressor, consequent.value, self);

                    }
                }
                // x=y?true:false --> x=!!y
                if (consequent instanceof AST_True
                    && alternative instanceof AST_False) {
                    self.condition = self.condition.negate(compressor);
                    return make_node(AST_UnaryPrefix, self.condition, {
                        operator: "!",
                        expression: self.condition
                    });
                }
                // x=y?false:true --> x=!y
                if (consequent instanceof AST_False
                    && alternative instanceof AST_True) {
                    return self.condition.negate(compressor)
                }
                return self;
            });

            OPT(AST_Boolean, function (self, compressor) {
                if (compressor.option("booleans")) {
                    var p = compressor.parent();
                    if (p instanceof AST_Binary && (p.operator == "=="
                        || p.operator == "!=")) {
                        compressor.warn("Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]", {
                            operator: p.operator,
                            value: self.value,
                            file: p.start.file,
                            line: p.start.line,
                            col: p.start.col,
                        });
                        return make_node(AST_Number, self, {
                            value: +self.value
                        });
                    }
                    return make_node(AST_UnaryPrefix, self, {
                        operator: "!",
                        expression: make_node(AST_Number, self, {
                            value: 1 - self.value
                        })
                    });
                }
                return self;
            });

            OPT(AST_Sub, function (self, compressor) {
                var prop = self.property;
                if (prop instanceof AST_String && compressor.option("properties")) {
                    prop = prop.getValue();
                    if (RESERVED_WORDS(prop) ? compressor.option("screw_ie8") : is_identifier_string(prop)) {
                        return make_node(AST_Dot, self, {
                            expression: self.expression,
                            property: prop
                        }).optimize(compressor);
                    }
                    var v = parseFloat(prop);
                    if (!isNaN(v) && v.toString() == prop) {
                        self.property = make_node(AST_Number, self.property, {
                            value: v
                        });
                    }
                }
                return self;
            });

            OPT(AST_Dot, function (self, compressor) {
                var prop = self.property;
                if (RESERVED_WORDS(prop) && !compressor.option("screw_ie8")) {
                    return make_node(AST_Sub, self, {
                        expression: self.expression,
                        property: make_node(AST_String, self, {
                            value: prop
                        })
                    }).optimize(compressor);
                }
                return self.evaluate(compressor)[0];
            });

            function literals_in_boolean_context(self, compressor) {
                if (compressor.option("booleans") && compressor.in_boolean_context() && !self.has_side_effects(compressor)) {
                    return make_node(AST_True, self);
                }
                return self;
            };
            OPT(AST_Array, literals_in_boolean_context);
            OPT(AST_Object, literals_in_boolean_context);
            OPT(AST_RegExp, literals_in_boolean_context);

            OPT(AST_Return, function (self, compressor) {
                if (self.value instanceof AST_Undefined) {
                    self.value = null;
                }
                return self;
            });

        })();

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

// a small wrapper around fitzgen's source-map library
        function SourceMap(options) {
            options = defaults(options, {
                file: null,
                root: null,
                orig: null,

                orig_line_diff: 0,
                dest_line_diff: 0,
            });
            var orig_map = options.orig && new MOZ_SourceMap.SourceMapConsumer(options.orig);
            var generator;
            if (orig_map) {
                generator = MOZ_SourceMap.SourceMapGenerator.fromSourceMap(orig_map);
            } else {
                generator = new MOZ_SourceMap.SourceMapGenerator({
                    file: options.file,
                    sourceRoot: options.root
                });
            }

            function add(source, gen_line, gen_col, orig_line, orig_col, name) {
                if (orig_map) {
                    var info = orig_map.originalPositionFor({
                        line: orig_line,
                        column: orig_col
                    });
                    if (info.source === null) {
                        return;
                    }
                    source = info.source;
                    orig_line = info.line;
                    orig_col = info.column;
                    name = info.name || name;
                }
                generator.addMapping({
                    generated: {line: gen_line + options.dest_line_diff, column: gen_col},
                    original: {line: orig_line + options.orig_line_diff, column: orig_col},
                    source: source,
                    name: name
                });
            }

            return {
                add: add,
                get: function () {
                    return generator
                },
                toString: function () {
                    return JSON.stringify(generator.toJSON());
                }
            };
        };

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        (function () {

            var MOZ_TO_ME = {
                ExpressionStatement: function (M) {
                    var expr = M.expression;
                    if (expr.type === "Literal" && typeof expr.value === "string") {
                        return new AST_Directive({
                            start: my_start_token(M),
                            end: my_end_token(M),
                            value: expr.value
                        });
                    }
                    return new AST_SimpleStatement({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        body: from_moz(expr)
                    });
                },
                TryStatement: function (M) {
                    var handlers = M.handlers || [M.handler];
                    if (handlers.length > 1 || M.guardedHandlers && M.guardedHandlers.length) {
                        throw new Error("Multiple catch clauses are not supported.");
                    }
                    return new AST_Try({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        body: from_moz(M.block).body,
                        bcatch: from_moz(handlers[0]),
                        bfinally: M.finalizer ? new AST_Finally(from_moz(M.finalizer)) : null
                    });
                },
                Property: function (M) {
                    var key = M.key;
                    var name = key.type == "Identifier" ? key.name : key.value;
                    var args = {
                        start: my_start_token(key),
                        end: my_end_token(M.value),
                        key: name,
                        value: from_moz(M.value)
                    };
                    switch (M.kind) {
                        case "init":
                            return new AST_ObjectKeyVal(args);
                        case "set":
                            args.value.name = from_moz(key);
                            return new AST_ObjectSetter(args);
                        case "get":
                            args.value.name = from_moz(key);
                            return new AST_ObjectGetter(args);
                    }
                },
                ObjectExpression: function (M) {
                    return new AST_Object({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        properties: M.properties.map(function (prop) {
                            prop.type = "Property";
                            return from_moz(prop)
                        })
                    });
                },
                SequenceExpression: function (M) {
                    return AST_Seq.from_array(M.expressions.map(from_moz));
                },
                MemberExpression: function (M) {
                    return new (M.computed ? AST_Sub : AST_Dot)({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        property: M.computed ? from_moz(M.property) : M.property.name,
                        expression: from_moz(M.object)
                    });
                },
                SwitchCase: function (M) {
                    return new (M.test ? AST_Case : AST_Default)({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        expression: from_moz(M.test),
                        body: M.consequent.map(from_moz)
                    });
                },
                VariableDeclaration: function (M) {
                    return new (M.kind === "const" ? AST_Const : AST_Var)({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        definitions: M.declarations.map(from_moz)
                    });
                },
                Literal: function (M) {
                    var val = M.value, args = {
                        start: my_start_token(M),
                        end: my_end_token(M)
                    };
                    if (val === null) return new AST_Null(args);
                    switch (typeof val) {
                        case "string":
                            args.value = val;
                            return new AST_String(args);
                        case "number":
                            args.value = val;
                            return new AST_Number(args);
                        case "boolean":
                            return new (val ? AST_True : AST_False)(args);
                        default:
                            var rx = M.regex;
                            if (rx && rx.pattern) {
                                // RegExpLiteral as per ESTree AST spec
                                args.value = new RegExp(rx.pattern, rx.flags).toString();
                            } else {
                                // support legacy RegExp
                                args.value = M.regex && M.raw ? M.raw : val;
                            }
                            return new AST_RegExp(args);
                    }
                },
                Identifier: function (M) {
                    var p = FROM_MOZ_STACK[FROM_MOZ_STACK.length - 2];
                    return new (p.type == "LabeledStatement" ? AST_Label
                        : p.type == "VariableDeclarator" && p.id === M ? (p.kind == "const" ? AST_SymbolConst : AST_SymbolVar)
                            : p.type == "FunctionExpression" ? (p.id === M ? AST_SymbolLambda : AST_SymbolFunarg)
                                : p.type == "FunctionDeclaration" ? (p.id === M ? AST_SymbolDefun : AST_SymbolFunarg)
                                    : p.type == "CatchClause" ? AST_SymbolCatch
                                        : p.type == "BreakStatement" || p.type == "ContinueStatement" ? AST_LabelRef
                                            : AST_SymbolRef)({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        name: M.name
                    });
                }
            };

            MOZ_TO_ME.UpdateExpression =
                MOZ_TO_ME.UnaryExpression = function To_Moz_Unary(M) {
                    var prefix = "prefix" in M ? M.prefix
                        : M.type == "UnaryExpression" ? true : false;
                    return new (prefix ? AST_UnaryPrefix : AST_UnaryPostfix)({
                        start: my_start_token(M),
                        end: my_end_token(M),
                        operator: M.operator,
                        expression: from_moz(M.argument)
                    });
                };

            map("Program", AST_Toplevel, "body@body");
            map("EmptyStatement", AST_EmptyStatement);
            map("BlockStatement", AST_BlockStatement, "body@body");
            map("IfStatement", AST_If, "test>condition, consequent>body, alternate>alternative");
            map("LabeledStatement", AST_LabeledStatement, "label>label, body>body");
            map("BreakStatement", AST_Break, "label>label");
            map("ContinueStatement", AST_Continue, "label>label");
            map("WithStatement", AST_With, "object>expression, body>body");
            map("SwitchStatement", AST_Switch, "discriminant>expression, cases@body");
            map("ReturnStatement", AST_Return, "argument>value");
            map("ThrowStatement", AST_Throw, "argument>value");
            map("WhileStatement", AST_While, "test>condition, body>body");
            map("DoWhileStatement", AST_Do, "test>condition, body>body");
            map("ForStatement", AST_For, "init>init, test>condition, update>step, body>body");
            map("ForInStatement", AST_ForIn, "left>init, right>object, body>body");
            map("DebuggerStatement", AST_Debugger);
            map("FunctionDeclaration", AST_Defun, "id>name, params@argnames, body%body");
            map("VariableDeclarator", AST_VarDef, "id>name, init>value");
            map("CatchClause", AST_Catch, "param>argname, body%body");

            map("ThisExpression", AST_This);
            map("ArrayExpression", AST_Array, "elements@elements");
            map("FunctionExpression", AST_Function, "id>name, params@argnames, body%body");
            map("BinaryExpression", AST_Binary, "operator=operator, left>left, right>right");
            map("LogicalExpression", AST_Binary, "operator=operator, left>left, right>right");
            map("AssignmentExpression", AST_Assign, "operator=operator, left>left, right>right");
            map("ConditionalExpression", AST_Conditional, "test>condition, consequent>consequent, alternate>alternative");
            map("NewExpression", AST_New, "callee>expression, arguments@args");
            map("CallExpression", AST_Call, "callee>expression, arguments@args");

            def_to_moz(AST_Directive, function To_Moz_Directive(M) {
                return {
                    type: "ExpressionStatement",
                    expression: {
                        type: "Literal",
                        value: M.value
                    }
                };
            });

            def_to_moz(AST_SimpleStatement, function To_Moz_ExpressionStatement(M) {
                return {
                    type: "ExpressionStatement",
                    expression: to_moz(M.body)
                };
            });

            def_to_moz(AST_SwitchBranch, function To_Moz_SwitchCase(M) {
                return {
                    type: "SwitchCase",
                    test: to_moz(M.expression),
                    consequent: M.body.map(to_moz)
                };
            });

            def_to_moz(AST_Try, function To_Moz_TryStatement(M) {
                return {
                    type: "TryStatement",
                    block: to_moz_block(M),
                    handler: to_moz(M.bcatch),
                    guardedHandlers: [],
                    finalizer: to_moz(M.bfinally)
                };
            });

            def_to_moz(AST_Catch, function To_Moz_CatchClause(M) {
                return {
                    type: "CatchClause",
                    param: to_moz(M.argname),
                    guard: null,
                    body: to_moz_block(M)
                };
            });

            def_to_moz(AST_Definitions, function To_Moz_VariableDeclaration(M) {
                return {
                    type: "VariableDeclaration",
                    kind: M instanceof AST_Const ? "const" : "var",
                    declarations: M.definitions.map(to_moz)
                };
            });

            def_to_moz(AST_Seq, function To_Moz_SequenceExpression(M) {
                return {
                    type: "SequenceExpression",
                    expressions: M.to_array().map(to_moz)
                };
            });

            def_to_moz(AST_PropAccess, function To_Moz_MemberExpression(M) {
                var isComputed = M instanceof AST_Sub;
                return {
                    type: "MemberExpression",
                    object: to_moz(M.expression),
                    computed: isComputed,
                    property: isComputed ? to_moz(M.property) : {type: "Identifier", name: M.property}
                };
            });

            def_to_moz(AST_Unary, function To_Moz_Unary(M) {
                return {
                    type: M.operator == "++" || M.operator == "--" ? "UpdateExpression" : "UnaryExpression",
                    operator: M.operator,
                    prefix: M instanceof AST_UnaryPrefix,
                    argument: to_moz(M.expression)
                };
            });

            def_to_moz(AST_Binary, function To_Moz_BinaryExpression(M) {
                return {
                    type: M.operator == "&&" || M.operator == "||" ? "LogicalExpression" : "BinaryExpression",
                    left: to_moz(M.left),
                    operator: M.operator,
                    right: to_moz(M.right)
                };
            });

            def_to_moz(AST_Object, function To_Moz_ObjectExpression(M) {
                return {
                    type: "ObjectExpression",
                    properties: M.properties.map(to_moz)
                };
            });

            def_to_moz(AST_ObjectProperty, function To_Moz_Property(M) {
                var key = (
                    is_identifier(M.key)
                        ? {type: "Identifier", name: M.key}
                        : {type: "Literal", value: M.key}
                );
                var kind;
                if (M instanceof AST_ObjectKeyVal) {
                    kind = "init";
                } else if (M instanceof AST_ObjectGetter) {
                    kind = "get";
                } else if (M instanceof AST_ObjectSetter) {
                    kind = "set";
                }
                return {
                    type: "Property",
                    kind: kind,
                    key: key,
                    value: to_moz(M.value)
                };
            });

            def_to_moz(AST_Symbol, function To_Moz_Identifier(M) {
                var def = M.definition();
                return {
                    type: "Identifier",
                    name: def ? def.mangled_name || def.name : M.name
                };
            });

            def_to_moz(AST_RegExp, function To_Moz_RegExpLiteral(M) {
                var value = M.value;
                return {
                    type: "Literal",
                    value: value,
                    raw: value.toString(),
                    regex: {
                        pattern: value.source,
                        flags: value.toString().match(/[gimuy]*$/)[0]
                    }
                };
            });

            def_to_moz(AST_Constant, function To_Moz_Literal(M) {
                var value = M.value;
                if (typeof value === 'number' && (value < 0 || (value === 0 && 1 / value < 0))) {
                    return {
                        type: "UnaryExpression",
                        operator: "-",
                        prefix: true,
                        argument: {
                            type: "Literal",
                            value: -value,
                            raw: M.start.raw
                        }
                    };
                }
                return {
                    type: "Literal",
                    value: value,
                    raw: M.start.raw
                };
            });

            def_to_moz(AST_Atom, function To_Moz_Atom(M) {
                return {
                    type: "Identifier",
                    name: String(M.value)
                };
            });

            AST_Boolean.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
            AST_Null.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
            AST_Hole.DEFMETHOD("to_mozilla_ast", function To_Moz_ArrayHole() {
                return null
            });

            AST_Block.DEFMETHOD("to_mozilla_ast", AST_BlockStatement.prototype.to_mozilla_ast);
            AST_Lambda.DEFMETHOD("to_mozilla_ast", AST_Function.prototype.to_mozilla_ast);

            /* -----[ tools ]----- */

            function raw_token(moznode) {
                if (moznode.type == "Literal") {
                    return moznode.raw != null ? moznode.raw : moznode.value + "";
                }
            }

            function my_start_token(moznode) {
                var loc = moznode.loc, start = loc && loc.start;
                var range = moznode.range;
                return new AST_Token({
                    file: loc && loc.source,
                    line: start && start.line,
                    col: start && start.column,
                    pos: range ? range[0] : moznode.start,
                    endline: start && start.line,
                    endcol: start && start.column,
                    endpos: range ? range[0] : moznode.start,
                    raw: raw_token(moznode),
                });
            };

            function my_end_token(moznode) {
                var loc = moznode.loc, end = loc && loc.end;
                var range = moznode.range;
                return new AST_Token({
                    file: loc && loc.source,
                    line: end && end.line,
                    col: end && end.column,
                    pos: range ? range[1] : moznode.end,
                    endline: end && end.line,
                    endcol: end && end.column,
                    endpos: range ? range[1] : moznode.end,
                    raw: raw_token(moznode),
                });
            };

            function map(moztype, mytype, propmap) {
                var moz_to_me = "function From_Moz_" + moztype + "(M){\n";
                moz_to_me += "return new U2." + mytype.name + "({\n" +
                    "start: my_start_token(M),\n" +
                    "end: my_end_token(M)";

                var me_to_moz = "function To_Moz_" + moztype + "(M){\n";
                me_to_moz += "return {\n" +
                    "type: " + JSON.stringify(moztype);

                if (propmap) propmap.split(/\s*,\s*/).forEach(function (prop) {
                    var m = /([a-z0-9$_]+)(=|@|>|%)([a-z0-9$_]+)/i.exec(prop);
                    if (!m) throw new Error("Can't understand property map: " + prop);
                    var moz = m[1], how = m[2], my = m[3];
                    moz_to_me += ",\n" + my + ": ";
                    me_to_moz += ",\n" + moz + ": ";
                    switch (how) {
                        case "@":
                            moz_to_me += "M." + moz + ".map(from_moz)";
                            me_to_moz += "M." + my + ".map(to_moz)";
                            break;
                        case ">":
                            moz_to_me += "from_moz(M." + moz + ")";
                            me_to_moz += "to_moz(M." + my + ")";
                            break;
                        case "=":
                            moz_to_me += "M." + moz;
                            me_to_moz += "M." + my;
                            break;
                        case "%":
                            moz_to_me += "from_moz(M." + moz + ").body";
                            me_to_moz += "to_moz_block(M)";
                            break;
                        default:
                            throw new Error("Can't understand operator in propmap: " + prop);
                    }
                });

                moz_to_me += "\n})\n}";
                me_to_moz += "\n}\n}";

                //moz_to_me = parse(moz_to_me).print_to_string({ beautify: true });
                //me_to_moz = parse(me_to_moz).print_to_string({ beautify: true });
                //console.log(moz_to_me);

                moz_to_me = new Function("U2", "my_start_token", "my_end_token", "from_moz", "return(" + moz_to_me + ")")(
                    exports, my_start_token, my_end_token, from_moz
                );
                me_to_moz = new Function("to_moz", "to_moz_block", "return(" + me_to_moz + ")")(
                    to_moz, to_moz_block
                );
                MOZ_TO_ME[moztype] = moz_to_me;
                def_to_moz(mytype, me_to_moz);
            };

            var FROM_MOZ_STACK = null;

            function from_moz(node) {
                FROM_MOZ_STACK.push(node);
                var ret = node != null ? MOZ_TO_ME[node.type](node) : null;
                FROM_MOZ_STACK.pop();
                return ret;
            };

            AST_Node.from_mozilla_ast = function (node) {
                var save_stack = FROM_MOZ_STACK;
                FROM_MOZ_STACK = [];
                var ast = from_moz(node);
                FROM_MOZ_STACK = save_stack;
                return ast;
            };

            function set_moz_loc(mynode, moznode, myparent) {
                var start = mynode.start;
                var end = mynode.end;
                if (start.pos != null && end.endpos != null) {
                    moznode.range = [start.pos, end.endpos];
                }
                if (start.line) {
                    moznode.loc = {
                        start: {line: start.line, column: start.col},
                        end: end.endline ? {line: end.endline, column: end.endcol} : null
                    };
                    if (start.file) {
                        moznode.loc.source = start.file;
                    }
                }
                return moznode;
            };

            function def_to_moz(mytype, handler) {
                mytype.DEFMETHOD("to_mozilla_ast", function () {
                    return set_moz_loc(this, handler(this));
                });
            };

            function to_moz(node) {
                return node != null ? node.to_mozilla_ast() : null;
            };

            function to_moz_block(node) {
                return {
                    type: "BlockStatement",
                    body: node.body.map(to_moz)
                };
            };

        })();

        /***********************************************************************

         A JavaScript tokenizer / parser / beautifier / compressor.
         https://github.com/mishoo/UglifyJS2

         -------------------------------- (C) ---------------------------------

         Author: Mihai Bazon
         <mihai.bazon@gmail.com>
         http://mihai.bazon.net/blog

         Distributed under the BSD license:

         Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

         Redistribution and use in source and binary forms, with or without
         modification, are permitted provided that the following conditions
         are met:

         * Redistributions of source code must retain the above
         copyright notice, this list of conditions and the following
         disclaimer.

         * Redistributions in binary form must reproduce the above
         copyright notice, this list of conditions and the following
         disclaimer in the documentation and/or other materials
         provided with the distribution.

         THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
         EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
         IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
         PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
         LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
         OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
         PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
         PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
         THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
         TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
         THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
         SUCH DAMAGE.

         ***********************************************************************/

        "use strict";

        function find_builtins() {
            var a = [];
            [Object, Array, Function, Number,
                String, Boolean, Error, Math,
                Date, RegExp
            ].forEach(function (ctor) {
                Object.getOwnPropertyNames(ctor).map(add);
                if (ctor.prototype) {
                    Object.getOwnPropertyNames(ctor.prototype).map(add);
                }
            });

            function add(name) {
                push_uniq(a, name);
            }

            return a;
        }

        function mangle_properties(ast, options) {
            options = defaults(options, {
                reserved: null,
                cache: null,
                only_cache: false,
                regex: null
            });

            var reserved = options.reserved;
            if (reserved == null)
                reserved = find_builtins();

            var cache = options.cache;
            if (cache == null) {
                cache = {
                    cname: -1,
                    props: new Dictionary()
                };
            }

            var regex = options.regex;

            var names_to_mangle = [];
            var unmangleable = [];

            // step 1: find candidates to mangle
            ast.walk(new TreeWalker(function (node) {
                if (node instanceof AST_ObjectKeyVal) {
                    add(node.key);
                } else if (node instanceof AST_ObjectProperty) {
                    // setter or getter, since KeyVal is handled above
                    add(node.key.name);
                } else if (node instanceof AST_Dot) {
                    if (this.parent() instanceof AST_Assign) {
                        add(node.property);
                    }
                } else if (node instanceof AST_Sub) {
                    if (this.parent() instanceof AST_Assign) {
                        addStrings(node.property);
                    }
                }
            }));

            // step 2: transform the tree, renaming properties
            return ast.transform(new TreeTransformer(function (node) {
                if (node instanceof AST_ObjectKeyVal) {
                    node.key = mangle(node.key);
                } else if (node instanceof AST_ObjectProperty) {
                    // setter or getter
                    node.key.name = mangle(node.key.name);
                } else if (node instanceof AST_Dot) {
                    node.property = mangle(node.property);
                } else if (node instanceof AST_Sub) {
                    node.property = mangleStrings(node.property);
                }
                // else if (node instanceof AST_String) {
                //     if (should_mangle(node.value)) {
                //         AST_Node.warn(
                //             "Found \"{prop}\" property candidate for mangling in an arbitrary string [{file}:{line},{col}]", {
                //                 file : node.start.file,
                //                 line : node.start.line,
                //                 col  : node.start.col,
                //                 prop : node.value
                //             }
                //         );
                //     }
                // }
            }));

            // only function declarations after this line

            function can_mangle(name) {
                if (unmangleable.indexOf(name) >= 0) return false;
                if (reserved.indexOf(name) >= 0) return false;
                if (options.only_cache) {
                    return cache.props.has(name);
                }
                if (/^[0-9.]+$/.test(name)) return false;
                return true;
            }

            function should_mangle(name) {
                if (regex && !regex.test(name)) return false;
                if (reserved.indexOf(name) >= 0) return false;
                return cache.props.has(name)
                    || names_to_mangle.indexOf(name) >= 0;
            }

            function add(name) {
                if (can_mangle(name))
                    push_uniq(names_to_mangle, name);

                if (!should_mangle(name)) {
                    push_uniq(unmangleable, name);
                }
            }

            function mangle(name) {
                if (!should_mangle(name)) {
                    return name;
                }

                var mangled = cache.props.get(name);
                if (!mangled) {
                    do {
                        mangled = base54(++cache.cname);
                    } while (!can_mangle(mangled));
                    cache.props.set(name, mangled);
                }
                return mangled;
            }

            function addStrings(node) {
                var out = {};
                try {
                    (function walk(node) {
                        node.walk(new TreeWalker(function (node) {
                            if (node instanceof AST_Seq) {
                                walk(node.cdr);
                                return true;
                            }
                            if (node instanceof AST_String) {
                                add(node.value);
                                return true;
                            }
                            if (node instanceof AST_Conditional) {
                                walk(node.consequent);
                                walk(node.alternative);
                                return true;
                            }
                            throw out;
                        }));
                    })(node);
                } catch (ex) {
                    if (ex !== out) throw ex;
                }
            }

            function mangleStrings(node) {
                return node.transform(new TreeTransformer(function (node) {
                    if (node instanceof AST_Seq) {
                        node.cdr = mangleStrings(node.cdr);
                    } else if (node instanceof AST_String) {
                        node.value = mangle(node.value);
                    } else if (node instanceof AST_Conditional) {
                        node.consequent = mangleStrings(node.consequent);
                        node.alternative = mangleStrings(node.alternative);
                    }
                    return node;
                }));
            }

        }

        exports["Compressor"] = Compressor;
        exports["DefaultsError"] = DefaultsError;
        exports["Dictionary"] = Dictionary;
        exports["JS_Parse_Error"] = JS_Parse_Error;
        exports["MAP"] = MAP;
        exports["OutputStream"] = OutputStream;
        exports["SourceMap"] = SourceMap;
        exports["TreeTransformer"] = TreeTransformer;
        exports["TreeWalker"] = TreeWalker;
        exports["base54"] = base54;
        exports["defaults"] = defaults;
        exports["mangle_properties"] = mangle_properties;
        exports["merge"] = merge;
        exports["parse"] = parse;
        exports["push_uniq"] = push_uniq;
        exports["string_template"] = string_template;
        exports["is_identifier"] = is_identifier;


        exports.sys = sys;
        exports.MOZ_SourceMap = MOZ_SourceMap;
        exports.UglifyJS = UglifyJS;
        exports.array_to_hash = array_to_hash;
        exports.slice = slice;
        exports.characters = characters;
        exports.member = member;
        exports.find_if = find_if;
        exports.repeat_string = repeat_string;
        exports.DefaultsError = DefaultsError;
        exports.defaults = defaults;
        exports.merge = merge;
        exports.noop = noop;
        exports.MAP = MAP;
        exports.push_uniq = push_uniq;
        exports.string_template = string_template;
        exports.remove = remove;
        exports.mergeSort = mergeSort;
        exports.set_difference = set_difference;
        exports.set_intersection = set_intersection;
        exports.makePredicate = makePredicate;
        exports.all = all;
        exports.Dictionary = Dictionary;
        exports.DEFNODE = DEFNODE;
        exports.AST_Token = AST_Token;
        exports.AST_Node = AST_Node;
        exports.AST_Statement = AST_Statement;
        exports.AST_Debugger = AST_Debugger;
        exports.AST_Directive = AST_Directive;
        exports.AST_SimpleStatement = AST_SimpleStatement;
        exports.walk_body = walk_body;
        exports.AST_Block = AST_Block;
        exports.AST_BlockStatement = AST_BlockStatement;
        exports.AST_EmptyStatement = AST_EmptyStatement;
        exports.AST_StatementWithBody = AST_StatementWithBody;
        exports.AST_LabeledStatement = AST_LabeledStatement;
        exports.AST_IterationStatement = AST_IterationStatement;
        exports.AST_DWLoop = AST_DWLoop;
        exports.AST_Do = AST_Do;
        exports.AST_While = AST_While;
        exports.AST_For = AST_For;
        exports.AST_ForIn = AST_ForIn;
        exports.AST_With = AST_With;
        exports.AST_Scope = AST_Scope;
        exports.AST_Toplevel = AST_Toplevel;
        exports.AST_Lambda = AST_Lambda;
        exports.AST_Accessor = AST_Accessor;
        exports.AST_Function = AST_Function;
        exports.AST_Defun = AST_Defun;
        exports.AST_Jump = AST_Jump;
        exports.AST_Exit = AST_Exit;
        exports.AST_Return = AST_Return;
        exports.AST_Throw = AST_Throw;
        exports.AST_LoopControl = AST_LoopControl;
        exports.AST_Break = AST_Break;
        exports.AST_Continue = AST_Continue;
        exports.AST_If = AST_If;
        exports.AST_Switch = AST_Switch;
        exports.AST_SwitchBranch = AST_SwitchBranch;
        exports.AST_Default = AST_Default;
        exports.AST_Case = AST_Case;
        exports.AST_Try = AST_Try;
        exports.AST_Catch = AST_Catch;
        exports.AST_Finally = AST_Finally;
        exports.AST_Definitions = AST_Definitions;
        exports.AST_Var = AST_Var;
        exports.AST_Const = AST_Const;
        exports.AST_VarDef = AST_VarDef;
        exports.AST_Call = AST_Call;
        exports.AST_New = AST_New;
        exports.AST_Seq = AST_Seq;
        exports.AST_PropAccess = AST_PropAccess;
        exports.AST_Dot = AST_Dot;
        exports.AST_Sub = AST_Sub;
        exports.AST_Unary = AST_Unary;
        exports.AST_UnaryPrefix = AST_UnaryPrefix;
        exports.AST_UnaryPostfix = AST_UnaryPostfix;
        exports.AST_Binary = AST_Binary;
        exports.AST_Conditional = AST_Conditional;
        exports.AST_Assign = AST_Assign;
        exports.AST_Array = AST_Array;
        exports.AST_Object = AST_Object;
        exports.AST_ObjectProperty = AST_ObjectProperty;
        exports.AST_ObjectKeyVal = AST_ObjectKeyVal;
        exports.AST_ObjectSetter = AST_ObjectSetter;
        exports.AST_ObjectGetter = AST_ObjectGetter;
        exports.AST_Symbol = AST_Symbol;
        exports.AST_SymbolAccessor = AST_SymbolAccessor;
        exports.AST_SymbolDeclaration = AST_SymbolDeclaration;
        exports.AST_SymbolVar = AST_SymbolVar;
        exports.AST_SymbolConst = AST_SymbolConst;
        exports.AST_SymbolFunarg = AST_SymbolFunarg;
        exports.AST_SymbolDefun = AST_SymbolDefun;
        exports.AST_SymbolLambda = AST_SymbolLambda;
        exports.AST_SymbolCatch = AST_SymbolCatch;
        exports.AST_Label = AST_Label;
        exports.AST_SymbolRef = AST_SymbolRef;
        exports.AST_LabelRef = AST_LabelRef;
        exports.AST_This = AST_This;
        exports.AST_Constant = AST_Constant;
        exports.AST_String = AST_String;
        exports.AST_Number = AST_Number;
        exports.AST_RegExp = AST_RegExp;
        exports.AST_Atom = AST_Atom;
        exports.AST_Null = AST_Null;
        exports.AST_NaN = AST_NaN;
        exports.AST_Undefined = AST_Undefined;
        exports.AST_Hole = AST_Hole;
        exports.AST_Infinity = AST_Infinity;
        exports.AST_Boolean = AST_Boolean;
        exports.AST_False = AST_False;
        exports.AST_True = AST_True;
        exports.TreeWalker = TreeWalker;
        exports.KEYWORDS = KEYWORDS;
        exports.KEYWORDS_ATOM = KEYWORDS_ATOM;
        exports.RESERVED_WORDS = RESERVED_WORDS;
        exports.KEYWORDS_BEFORE_EXPRESSION = KEYWORDS_BEFORE_EXPRESSION;
        exports.OPERATOR_CHARS = OPERATOR_CHARS;
        exports.RE_HEX_NUMBER = RE_HEX_NUMBER;
        exports.RE_OCT_NUMBER = RE_OCT_NUMBER;
        exports.OPERATORS = OPERATORS;
        exports.WHITESPACE_CHARS = WHITESPACE_CHARS;
        exports.PUNC_BEFORE_EXPRESSION = PUNC_BEFORE_EXPRESSION;
        exports.PUNC_CHARS = PUNC_CHARS;
        exports.REGEXP_MODIFIERS = REGEXP_MODIFIERS;
        exports.UNICODE = UNICODE;
        exports.is_letter = is_letter;
        exports.is_digit = is_digit;
        exports.is_alphanumeric_char = is_alphanumeric_char;
        exports.is_unicode_digit = is_unicode_digit;
        exports.is_unicode_combining_mark = is_unicode_combining_mark;
        exports.is_unicode_connector_punctuation = is_unicode_connector_punctuation;
        exports.is_identifier = is_identifier;
        exports.is_identifier_start = is_identifier_start;
        exports.is_identifier_char = is_identifier_char;
        exports.is_identifier_string = is_identifier_string;
        exports.parse_js_number = parse_js_number;
        exports.JS_Parse_Error = JS_Parse_Error;
        exports.js_error = js_error;
        exports.is_token = is_token;
        exports.EX_EOF = EX_EOF;
        exports.tokenizer = tokenizer;
        exports.UNARY_PREFIX = UNARY_PREFIX;
        exports.UNARY_POSTFIX = UNARY_POSTFIX;
        exports.ASSIGNMENT = ASSIGNMENT;
        exports.PRECEDENCE = PRECEDENCE;
        exports.STATEMENTS_WITH_LABELS = STATEMENTS_WITH_LABELS;
        exports.ATOMIC_START_TOKEN = ATOMIC_START_TOKEN;
        exports.parse = parse;
        exports.TreeTransformer = TreeTransformer;
        exports.SymbolDef = SymbolDef;
        exports.base54 = base54;
        exports.OutputStream = OutputStream;
        exports.Compressor = Compressor;
        exports.SourceMap = SourceMap;
        exports.find_builtins = find_builtins;
        exports.mangle_properties = mangle_properties;

        exports.AST_Node.warn_function = function (txt) {
            if (typeof console != "undefined" && typeof console.warn === "function") console.warn(txt)
        }

        exports.minify = function (files, options) {
            options = UglifyJS.defaults(options, {
                spidermonkey: false,
                outSourceMap: null,
                sourceRoot: null,
                inSourceMap: null,
                fromString: false,
                warnings: false,
                mangle: {},
                output: null,
                compress: {}
            });
            UglifyJS.base54.reset();

            // 1. parse
            var toplevel = null,
                sourcesContent = {};

            if (options.spidermonkey) {
                toplevel = UglifyJS.AST_Node.from_mozilla_ast(files);
            } else {
                if (typeof files == "string")
                    files = [files];
                files.forEach(function (file, i) {
                    var code = options.fromString
                        ? file
                        : fs.readFileSync(file, "utf8");
                    sourcesContent[file] = code;
                    toplevel = UglifyJS.parse(code, {
                        filename: options.fromString ? i : file,
                        toplevel: toplevel
                    });
                });
            }
            if (options.wrap) {
                toplevel = toplevel.wrap_commonjs(options.wrap, options.exportAll);
            }

            // 2. compress
            if (options.compress) {
                var compress = {warnings: options.warnings};
                UglifyJS.merge(compress, options.compress);
                toplevel.figure_out_scope();
                var sq = UglifyJS.Compressor(compress);
                toplevel = toplevel.transform(sq);
            }

            // 3. mangle
            if (options.mangle) {
                toplevel.figure_out_scope(options.mangle);
                toplevel.compute_char_frequency(options.mangle);
                toplevel.mangle_names(options.mangle);
            }

            // 4. output
            var inMap = options.inSourceMap;
            var output = {};
            if (typeof options.inSourceMap == "string") {
                inMap = fs.readFileSync(options.inSourceMap, "utf8");
            }
            if (options.outSourceMap) {
                output.source_map = UglifyJS.SourceMap({
                    file: options.outSourceMap,
                    orig: inMap,
                    root: options.sourceRoot
                });
                if (options.sourceMapIncludeSources) {
                    for (var file in sourcesContent) {
                        if (sourcesContent.hasOwnProperty(file)) {
                            output.source_map.get().setSourceContent(file, sourcesContent[file]);
                        }
                    }
                }

            }
            if (options.output) {
                UglifyJS.merge(output, options.output);
            }
            var stream = UglifyJS.OutputStream(output);
            toplevel.print(stream);

            if (options.outSourceMap && "string" === typeof options.outSourceMap) {
                stream += "\n//# sourceMappingURL=" + options.outSourceMap;
            }

            var source_map = output.source_map;
            if (source_map) {
                source_map = source_map + "";
            }

            return {
                code: stream + "",
                map: source_map
            };
        };

        exports.describe_ast = function () {
            var out = UglifyJS.OutputStream({beautify: true});

            function doitem(ctor) {
                out.print("AST_" + ctor.TYPE);
                var props = ctor.SELF_PROPS.filter(function (prop) {
                    return !/^\$/.test(prop);
                });
                if (props.length > 0) {
                    out.space();
                    out.with_parens(function () {
                        props.forEach(function (prop, i) {
                            if (i) out.space();
                            out.print(prop);
                        });
                    });
                }
                if (ctor.documentation) {
                    out.space();
                    out.print_string(ctor.documentation);
                }
                if (ctor.SUBCLASSES.length > 0) {
                    out.space();
                    out.with_block(function () {
                        ctor.SUBCLASSES.forEach(function (ctor, i) {
                            out.indent();
                            doitem(ctor);
                            out.newline();
                        });
                    });
                }
            };
            doitem(UglifyJS.AST_Node);
            return out + "";
        };
    }, {"source-map": 20, "util": 8}], 22: [function (require, module, exports) {
// Uiscc
        var UglifyJS = require("uglify-js");
        var byteSize = require('byte-size');
        var stringSize = require('../module/stringSize');
        var Sortable = require('../module/Sortable');
        var Clipboard = require('../module/clipboard');
        var JSZip = require('../module/jszip.min');
        var saveAs = require('../module/FileSaver');


        var pattern = 'paste';    // 储存tab当前在功能页面
        var dropData = [];        // 储存拖入数据
        var onecDropData = [];    // 储存一次拖入的数据
        var indexesArray = [];    // 存储实际顺序下标
        var timeOut = null;


// 快速复制
        new Clipboard('#copy', {
            text: function () {
                $('#tipMask').removeClass('fn-hide');
                return pattern === 'paste' ? $('#jsTextarea').val() || 'http://www.ossoft.cn' : $('#fileTextarea').val() || 'http://www.ossoft.cn';
            }
        });

        $('#tipMask .btn-close').on('click', function () {
            $('#tipMask').addClass('fn-hide');
        });


// tab
        $('.tab').on('click', '.hd div', function () {
            $(this).addClass('active').siblings('div').removeClass('active');
            $('.tab').find('.bd > div').removeClass('active').eq($(this).index()).addClass('active');
            pattern = $(this).data('pattern');                            // 改变当前所在压缩方式得变量
        });

// 文件拖动组件
// =============================
        var oDropBox = document.getElementById('dorpBox');
        oDropBox.addEventListener('drop', function (event) {
            event.preventDefault();
            var fileList = event.dataTransfer.files;
            for (var i = 0; i < fileList.length; i++) {
                console.log(111)
                readerFile(fileList[i], fileList.length);   // 调用读取文件
            }
        }, false);
        oDropBox.addEventListener('dragover', function (e) {
            e.preventDefault();
        }, false);

        $('#dorpBox').on('click', function () {
            $('#inputFile').trigger('click');
        });

        $('#inputFile').on("change", function () {
            if (this.files.length === 0) return;
            for (var i = 0; i < this.files.length; i++) {
                readerFile(this.files[i], this.files.length);            // 调用读取文件
            }
        });


// 文件读取是异步的
        function readerFile(file, len) {

            var reader = new FileReader();
            reader.readAsText(file);
            reader.onload = function () {
                onecDropData.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    date: file.lastModifiedDate,
                    text: this.result
                });
                if (onecDropData.length === len || len === 1) {   // 因为异步通过判断数量走回调
                    addDropListItem(onecDropData);
                }
            };
        }

// 添加列表条目
        function addDropListItem(data) {
            var domString = '';
            for (var i = 0; i < data.length; i++) {
                console.log(data[i].type);
                if (data[i].type.indexOf('javascript') !== -1) {
                    domString += '<li data-index="' + (dropData.length) + '"><div class="name">' + data[i].name + '</div><div class="size">' + byteSize(data[i].size, {units: 'iec', precision: 2}) + '</div><div class="icon-off"></div></li>';
                    dropData.push(data[i]);
                }
            }
            onecDropData = [];
            $(domString).appendTo('#items');
            domString && $('.list-box').slideDown(300);
        }

// 删除列表中的一项
        $('.icon-off').on('mousedown', function () {
            alert(1);
            $(this).closest('li').remove();
        });


// 列表拖拽组件
// =============================
        var list = $('#items').get(0);
        Sortable.create(list, {
            group: "omega",
            animation: 250,
            filter: '.icon-off',
            onFilter: function (evt) {
                if ($(evt.item).siblings('li').length === 0) {
                    $('.list-box').slideUp(300);
                }
                $(evt.item).hide('200', function () {
                    $(this).remove();
                });
                ;
            },
            onStart: function (evt) {
                console.log('当前移动得块位置:' + evt.oldIndex);
            },
            onEnd: function (evt) {
                console.log('从哪个位置移动来的:' + evt.oldIndex);
                console.log('移动到哪个块位置:' + evt.newIndex);
            },
            onMove: function (evt) {
                evt.dragged; // dragged HTMLElement
                evt.draggedRect; // TextRectangle {left, top, right и bottom}
                evt.related; // HTMLElement on which have guided
                evt.relatedRect; // TextRectangle
                console.log('move');
            }
        });


// 获取选项参数 返回一个obj
        function getInputOptions() {
            var options = {};

            options.mangle = $('#mangle').prop("checked");
            options.ascii_only = $('#asciiOnly').prop("checked");
            options.drop_console = $('#dropConsole').prop("checked");
            options.comments = $('#comments').prop("checked") ? false : 'all';
            options.indent_level = parseInt($('#indentLevel').val() || '2', 10);
            return options;
        }

// 获取要压缩的js代码
        function getJsCode() {
            if (pattern === 'paste') {    // 贴入代码压缩
                return $('#jsTextarea').val();
            } else {                      // 多文件合并压缩
                $('#items').find('li').each(function (index, el) {
                    indexesArray.push($(this).data('index'));
                });
                var tempString = '';
                for (var i = 0; i < indexesArray.length; i++) {
                    var str = dropData[indexesArray[i]].text;
                    tempString += str.charAt(str.length - 1) === ';' ? str : str + ';';
                }
                console.log(tempString);
                indexesArray = [];
                return tempString;
            }
        }

// 推出js代码到前台逻辑
        function putJsCode(code) {
            var buildCode = '/*!\n * Powered by uglifiyJS v2.6.1, Build by http://www.ossoft.cn\n * build time: ' + new Date() + '\n*/\n' + code;
            if (pattern === 'paste') {
                $('#jsTextarea').val(buildCode);
            } else {
                $('#fileTextarea').val(buildCode);
            }
            console.log(code);
        }

        function putCssCode(code) {
            var buildCode = '/*!\n * Build by http://www.ossoft.cn\n * build time: ' + new Date() + '\n*/\n' + code;
            $('#jsTextarea').val(buildCode);
            console.log(code);
        }

// 压缩代码
        $('#uglifiy').on('click', function () {
            $('#slowMask').removeClass('fn-hide');
            $('#promptInfo').html('');
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                var startDate = new Date() - 1;
                var jsCode = getJsCode();
                var option = getInputOptions();
                var resultString = '压缩前: <span class="c-red">' + byteSize(stringSize(jsCode), {units: 'iec', precision: 2}) + '</span>';
                var result = UglifyJS.minify(jsCode, {
                    mangle: option.mangle,                      // 是否压缩变量名称 true 压缩
                    fromString: true,
                    output: {
                        ascii_only: option.ascii_only,            // 将中文转为unicode编码
                        comments: option.comments,                // 是否保留注释 "all" 保留所有注释   false 删掉注释
                        beautify: false,                          // true 格式化代码   false压缩代码
                        indent_level: option.indent_level         // 格式化缩进空格数量
                    },
                    compress: {
                        drop_console: option.drop_console         // 去掉 console.log
                    }
                });

                putJsCode(result.code);
                resultString += ' 压缩后: <span class="c-green">' + byteSize(stringSize(result.code), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 数据减少:  <span class="c-orgin">' + byteSize((stringSize(jsCode) - stringSize(result.code)), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 压缩耗时:  <span class="c-green">' + parseInt((new Date() - startDate), 10) + 'ms</span>';
                $('#promptInfo').html(resultString);
                $('#slowMask').addClass('fn-hide');
            }, 10);

        });

// 美化代码
        $('#beautify').on('click', function () {
            $('#slowMask').removeClass('fn-hide');
            $('#promptInfo').html('');
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                var startDate = new Date() - 1;
                var jsCode = getJsCode();
                var option = getInputOptions();
                var resultString = '美化前: <span class="c-red">' + byteSize(stringSize(jsCode), {units: 'iec', precision: 2}) + '</span>';
                console.log(option);
                var result = UglifyJS.minify(jsCode, {
                    mangle: option.mangle,                      // 是否压缩变量名称 true 压缩
                    fromString: true,
                    output: {
                        ascii_only: option.ascii_only,            // 将中文转为unicode编码
                        comments: option.comments,                // 是否保留注释 "all" 保留所有注释   false 删掉注释
                        beautify: true,                           // true 格式化代码   false压缩代码
                        indent_level: option.indent_level         // 格式化缩进空格数量
                    },
                    compress: {
                        drop_console: option.drop_console         // 去掉 console.log
                    }
                });
                putJsCode(result.code);
                resultString += ' 美化后: <span class="c-green">' + byteSize(stringSize(result.code), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 数据变化:  <span class="c-orgin">' + byteSize(Math.abs(stringSize(jsCode) - stringSize(result.code)), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 美化耗时:  <span class="c-green">' + parseInt((new Date() - startDate), 10) + 'ms</span>';
                $('#promptInfo').html(resultString);
                $('#slowMask').addClass('fn-hide');
            }, 10);
        });


//css
        var lCSSCoder = {
            format: function (s) {//格式化代码
                s = s.replace(/\s*([\{\}\:\;\,])\s*/g, "$1");
                s = s.replace(/;\s*;/g, ";"); //清除连续分号
                s = s.replace(/\,[\s\.\#\d]*{/g, "{");
                s = s.replace(/([^\s])\{([^\s])/g, "$1 {\n\t$2");
                s = s.replace(/([^\s])\}([^\n]*)/g, "$1\n}\n$2");
                s = s.replace(/([^\s]);([^\s\}])/g, "$1;\n\t$2");
                if ($("#chk").prop("checked")) {
                    s = s.replace(/(\r|\n|\t)/g, "");
                    s = s.replace(/(})/g, "$1\r\n");
                }
                return s;
            },
            pack: function (s) {//压缩代码
                s = s.replace(/\/\*(.|\n)*?\*\//g, ""); //删除注释
                s = s.replace(/\s*([\{\}\:\;\,])\s*/g, "$1");
                s = s.replace(/\,[\s\.\#\d]*\{/g, "{"); //容错处理
                s = s.replace(/;\s*;/g, ";"); //清除连续分号
                s = s.match(/^\s*(\S+(\s+\S+)*)\s*$/); //去掉首尾空白
                return (s == null) ? "" : s[1];
            }
        };

        function CSS(s) {
            $('#slowMask').removeClass('fn-hide');
            $('#promptInfo').html('');
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                var startDate = new Date() - 1;
                var jsCode = $("#jsTextarea").val();
                var resultString = '美化前: <span class="c-red">' + byteSize(stringSize(jsCode), {units: 'iec', precision: 2}) + '</span>';
                if ($.trim(jsCode) === "") {
                    alert("请填写内容");
                    return false;
                }
                var result = lCSSCoder[s](jsCode)
                putCssCode(result);
                resultString += ' 压缩后: <span class="c-green">' + byteSize(stringSize(result), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 数据减少:  <span class="c-orgin">' + byteSize((stringSize(jsCode) - stringSize(result)), {units: 'iec', precision: 2}) + '</span>';
                resultString += ' 压缩耗时:  <span class="c-green">' + parseInt((new Date() - startDate), 10) + 'ms</span>';
                $('#promptInfo').html(resultString);
                $('#slowMask').addClass('fn-hide');
            }, 10);
        }

        $('#css_pack').on('click', function () {
            CSS('pack')
        });
        $('#css_format').on('click', function () {
            CSS('format')
        });

// 下载按钮
        $('#download').on('click', function () {
            var zip = new JSZip();
            zip.file("README.txt", "本版本经过 uglifiyJS v2.6.1 处理，如有问题请联系QQ：68851854\n同级目录下的 dist.min.js 为压缩后的文件。");
            zip.file("dist.min.js", pattern === 'paste' ? $('#jsTextarea').val() : $('#fileTextarea').val());
            var content = zip.generate({type: "blob"});
            saveAs(content, "minjs.zip");
        });


//判断浏览器是否支持FileReader接口
        if (typeof FileReader == 'undefined') {
            result.InnerHTML = "<p>你的浏览器不支持FileReader接口！</p>";
            // 使选择控件不可操作
            file.setAttribute("disabled", "disabled");
        }


    }, {"../module/FileSaver": 23, "../module/Sortable": 24, "../module/clipboard": 25, "../module/jszip.min": 26, "../module/stringSize": 27, "byte-size": 9, "uglify-js": 21}], 23: [function (require, module, exports) {
        /*! FileSaver.js
 *  A saveAs() FileSaver implementation.
 *  2014-01-24
 *
 *  By Eli Grey, http://eligrey.com
 *  License: X11/MIT
 *    See LICENSE.md
 */

        /*global self */
        /*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

        /*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

        var saveAs = saveAs
            // IE 10+ (native saveAs)
            || (typeof navigator !== "undefined" &&
                navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator))
            // Everyone else
            || (function (view) {
                "use strict";
                // IE <10 is explicitly unsupported
                if (typeof navigator !== "undefined" &&
                    /MSIE [1-9]\./.test(navigator.userAgent)) {
                    return;
                }
                var
                    doc = view.document
                    // only get URL when necessary in case BlobBuilder.js hasn't overridden it yet
                    , get_URL = function () {
                        return view.URL || view.webkitURL || view;
                    }
                    , URL = view.URL || view.webkitURL || view
                    , save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
                    , can_use_save_link = !view.externalHost && "download" in save_link
                    , click = function (node) {
                        var event = doc.createEvent("MouseEvents");
                        event.initMouseEvent(
                            "click", true, false, view, 0, 0, 0, 0, 0
                            , false, false, false, false, 0, null
                        );
                        node.dispatchEvent(event);
                    }
                    , webkit_req_fs = view.webkitRequestFileSystem
                    , req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
                    , throw_outside = function (ex) {
                        (view.setImmediate || view.setTimeout)(function () {
                            throw ex;
                        }, 0);
                    }
                    , force_saveable_type = "application/octet-stream"
                    , fs_min_size = 0
                    , deletion_queue = []
                    , process_deletion_queue = function () {
                        var i = deletion_queue.length;
                        while (i--) {
                            var file = deletion_queue[i];
                            if (typeof file === "string") { // file is an object URL
                                URL.revokeObjectURL(file);
                            } else { // file is a File
                                file.remove();
                            }
                        }
                        deletion_queue.length = 0; // clear queue
                    }
                    , dispatch = function (filesaver, event_types, event) {
                        event_types = [].concat(event_types);
                        var i = event_types.length;
                        while (i--) {
                            var listener = filesaver["on" + event_types[i]];
                            if (typeof listener === "function") {
                                try {
                                    listener.call(filesaver, event || filesaver);
                                } catch (ex) {
                                    throw_outside(ex);
                                }
                            }
                        }
                    }
                    , FileSaver = function (blob, name) {
                        // First try a.download, then web filesystem, then object URLs
                        var
                            filesaver = this
                            , type = blob.type
                            , blob_changed = false
                            , object_url
                            , target_view
                            , get_object_url = function () {
                                var object_url = get_URL().createObjectURL(blob);
                                deletion_queue.push(object_url);
                                return object_url;
                            }
                            , dispatch_all = function () {
                                dispatch(filesaver, "writestart progress write writeend".split(" "));
                            }
                            // on any filesys errors revert to saving with object URLs
                            , fs_error = function () {
                                // don't create more object URLs than needed
                                if (blob_changed || !object_url) {
                                    object_url = get_object_url(blob);
                                }
                                if (target_view) {
                                    target_view.location.href = object_url;
                                } else {
                                    window.open(object_url, "_blank");
                                }
                                filesaver.readyState = filesaver.DONE;
                                dispatch_all();
                            }
                            , abortable = function (func) {
                                return function () {
                                    if (filesaver.readyState !== filesaver.DONE) {
                                        return func.apply(this, arguments);
                                    }
                                };
                            }
                            , create_if_not_found = {create: true, exclusive: false}
                            , slice
                        ;
                        filesaver.readyState = filesaver.INIT;
                        if (!name) {
                            name = "download";
                        }
                        if (can_use_save_link) {
                            object_url = get_object_url(blob);
                            // FF for Android has a nasty garbage collection mechanism
                            // that turns all objects that are not pure javascript into 'deadObject'
                            // this means `doc` and `save_link` are unusable and need to be recreated
                            // `view` is usable though:
                            doc = view.document;
                            save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a");
                            save_link.href = object_url;
                            save_link.download = name;
                            var event = doc.createEvent("MouseEvents");
                            event.initMouseEvent(
                                "click", true, false, view, 0, 0, 0, 0, 0
                                , false, false, false, false, 0, null
                            );
                            save_link.dispatchEvent(event);
                            filesaver.readyState = filesaver.DONE;
                            dispatch_all();
                            return;
                        }
                        // Object and web filesystem URLs have a problem saving in Google Chrome when
                        // viewed in a tab, so I force save with application/octet-stream
                        // http://code.google.com/p/chromium/issues/detail?id=91158
                        if (view.chrome && type && type !== force_saveable_type) {
                            slice = blob.slice || blob.webkitSlice;
                            blob = slice.call(blob, 0, blob.size, force_saveable_type);
                            blob_changed = true;
                        }
                        // Since I can't be sure that the guessed media type will trigger a download
                        // in WebKit, I append .download to the filename.
                        // https://bugs.webkit.org/show_bug.cgi?id=65440
                        if (webkit_req_fs && name !== "download") {
                            name += ".download";
                        }
                        if (type === force_saveable_type || webkit_req_fs) {
                            target_view = view;
                        }
                        if (!req_fs) {
                            fs_error();
                            return;
                        }
                        fs_min_size += blob.size;
                        req_fs(view.TEMPORARY, fs_min_size, abortable(function (fs) {
                            fs.root.getDirectory("saved", create_if_not_found, abortable(function (dir) {
                                var save = function () {
                                    dir.getFile(name, create_if_not_found, abortable(function (file) {
                                        file.createWriter(abortable(function (writer) {
                                            writer.onwriteend = function (event) {
                                                target_view.location.href = file.toURL();
                                                deletion_queue.push(file);
                                                filesaver.readyState = filesaver.DONE;
                                                dispatch(filesaver, "writeend", event);
                                            };
                                            writer.onerror = function () {
                                                var error = writer.error;
                                                if (error.code !== error.ABORT_ERR) {
                                                    fs_error();
                                                }
                                            };
                                            "writestart progress write abort".split(" ").forEach(function (event) {
                                                writer["on" + event] = filesaver["on" + event];
                                            });
                                            writer.write(blob);
                                            filesaver.abort = function () {
                                                writer.abort();
                                                filesaver.readyState = filesaver.DONE;
                                            };
                                            filesaver.readyState = filesaver.WRITING;
                                        }), fs_error);
                                    }), fs_error);
                                };
                                dir.getFile(name, {create: false}, abortable(function (file) {
                                    // delete file if it already exists
                                    file.remove();
                                    save();
                                }), abortable(function (ex) {
                                    if (ex.code === ex.NOT_FOUND_ERR) {
                                        save();
                                    } else {
                                        fs_error();
                                    }
                                }));
                            }), fs_error);
                        }), fs_error);
                    }
                    , FS_proto = FileSaver.prototype
                    , saveAs = function (blob, name) {
                        return new FileSaver(blob, name);
                    }
                ;
                FS_proto.abort = function () {
                    var filesaver = this;
                    filesaver.readyState = filesaver.DONE;
                    dispatch(filesaver, "abort");
                };
                FS_proto.readyState = FS_proto.INIT = 0;
                FS_proto.WRITING = 1;
                FS_proto.DONE = 2;

                FS_proto.error =
                    FS_proto.onwritestart =
                        FS_proto.onprogress =
                            FS_proto.onwrite =
                                FS_proto.onabort =
                                    FS_proto.onerror =
                                        FS_proto.onwriteend =
                                            null;

                view.addEventListener("unload", process_deletion_queue, false);
                saveAs.unload = function () {
                    process_deletion_queue();
                    view.removeEventListener("unload", process_deletion_queue, false);
                };
                return saveAs;
            }(
                typeof self !== "undefined" && self
                || typeof window !== "undefined" && window
                || this.content
            ));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

        if (typeof module !== "undefined") module.exports = saveAs;

    }, {}], 24: [function (require, module, exports) {
        /**!
         * Sortable
         * @author    RubaXa   <trash@rubaxa.org>
         * @license MIT
         */


        (function (factory) {
            "use strict";

            if (typeof define === "function" && define.amd) {
                define(factory);
            } else if (typeof module != "undefined" && typeof module.exports != "undefined") {
                module.exports = factory();
            } else if (typeof Package !== "undefined") {
                Sortable = factory();  // export for Meteor.js
            } else {
                /* jshint sub:true */
                window["Sortable"] = factory();
            }
        })(function () {
            "use strict";

            var dragEl,
                parentEl,
                ghostEl,
                cloneEl,
                rootEl,
                nextEl,

                scrollEl,
                scrollParentEl,

                lastEl,
                lastCSS,
                lastParentCSS,

                oldIndex,
                newIndex,

                activeGroup,
                autoScroll = {},

                tapEvt,
                touchEvt,

                moved,

                /** @const */
                RSPACE = /\s+/g,

                expando = 'Sortable' + (new Date).getTime(),

                win = window,
                document = win.document,
                parseInt = win.parseInt,

                supportDraggable = !!('draggable' in document.createElement('div')),
                supportCssPointerEvents = (function (el) {
                    el = document.createElement('x');
                    el.style.cssText = 'pointer-events:auto';
                    return el.style.pointerEvents === 'auto';
                })(),

                _silent = false,

                abs = Math.abs,
                slice = [].slice,

                touchDragOverListeners = [],

                _autoScroll = _throttle(function (/**Event*/evt, /**Object*/options, /**HTMLElement*/rootEl) {
                    // Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
                    if (rootEl && options.scroll) {
                        var el,
                            rect,
                            sens = options.scrollSensitivity,
                            speed = options.scrollSpeed,

                            x = evt.clientX,
                            y = evt.clientY,

                            winWidth = window.innerWidth,
                            winHeight = window.innerHeight,

                            vx,
                            vy
                        ;

                        // Delect scrollEl
                        if (scrollParentEl !== rootEl) {
                            scrollEl = options.scroll;
                            scrollParentEl = rootEl;

                            if (scrollEl === true) {
                                scrollEl = rootEl;

                                do {
                                    if ((scrollEl.offsetWidth < scrollEl.scrollWidth) ||
                                        (scrollEl.offsetHeight < scrollEl.scrollHeight)
                                    ) {
                                        break;
                                    }
                                    /* jshint boss:true */
                                } while (scrollEl = scrollEl.parentNode);
                            }
                        }

                        if (scrollEl) {
                            el = scrollEl;
                            rect = scrollEl.getBoundingClientRect();
                            vx = (abs(rect.right - x) <= sens) - (abs(rect.left - x) <= sens);
                            vy = (abs(rect.bottom - y) <= sens) - (abs(rect.top - y) <= sens);
                        }


                        if (!(vx || vy)) {
                            vx = (winWidth - x <= sens) - (x <= sens);
                            vy = (winHeight - y <= sens) - (y <= sens);

                            /* jshint expr:true */
                            (vx || vy) && (el = win);
                        }


                        if (autoScroll.vx !== vx || autoScroll.vy !== vy || autoScroll.el !== el) {
                            autoScroll.el = el;
                            autoScroll.vx = vx;
                            autoScroll.vy = vy;

                            clearInterval(autoScroll.pid);

                            if (el) {
                                autoScroll.pid = setInterval(function () {
                                    if (el === win) {
                                        win.scrollTo(win.pageXOffset + vx * speed, win.pageYOffset + vy * speed);
                                    } else {
                                        vy && (el.scrollTop += vy * speed);
                                        vx && (el.scrollLeft += vx * speed);
                                    }
                                }, 24);
                            }
                        }
                    }
                }, 30),

                _prepareGroup = function (options) {
                    var group = options.group;

                    if (!group || typeof group != 'object') {
                        group = options.group = {name: group};
                    }

                    ['pull', 'put'].forEach(function (key) {
                        if (!(key in group)) {
                            group[key] = true;
                        }
                    });

                    options.groups = ' ' + group.name + (group.put.join ? ' ' + group.put.join(' ') : '') + ' ';
                }
            ;


            /**
             * @class  Sortable
             * @param  {HTMLElement}  el
             * @param  {Object}       [options]
             */
            function Sortable(el, options) {
                if (!(el && el.nodeType && el.nodeType === 1)) {
                    throw 'Sortable: `el` must be HTMLElement, and not ' + {}.toString.call(el);
                }

                this.el = el; // root element
                this.options = options = _extend({}, options);


                // Export instance
                el[expando] = this;


                // Default options
                var defaults = {
                    group: Math.random(),
                    sort: true,
                    disabled: false,
                    store: null,
                    handle: null,
                    scroll: true,
                    scrollSensitivity: 30,
                    scrollSpeed: 10,
                    draggable: /[uo]l/i.test(el.nodeName) ? 'li' : '>*',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    ignore: 'a, img',
                    filter: null,
                    animation: 0,
                    setData: function (dataTransfer, dragEl) {
                        dataTransfer.setData('Text', dragEl.textContent);
                    },
                    dropBubble: false,
                    dragoverBubble: false,
                    dataIdAttr: 'data-id',
                    delay: 0,
                    forceFallback: false,
                    fallbackClass: 'sortable-fallback',
                    fallbackOnBody: false
                };


                // Set default options
                for (var name in defaults) {
                    !(name in options) && (options[name] = defaults[name]);
                }

                _prepareGroup(options);

                // Bind all private methods
                for (var fn in this) {
                    if (fn.charAt(0) === '_') {
                        this[fn] = this[fn].bind(this);
                    }
                }

                // Setup drag mode
                this.nativeDraggable = options.forceFallback ? false : supportDraggable;

                // Bind events
                _on(el, 'mousedown', this._onTapStart);
                _on(el, 'touchstart', this._onTapStart);

                if (this.nativeDraggable) {
                    _on(el, 'dragover', this);
                    _on(el, 'dragenter', this);
                }

                touchDragOverListeners.push(this._onDragOver);

                // Restore sorting
                options.store && this.sort(options.store.get(this));
            }


            Sortable.prototype = /** @lends Sortable.prototype */ {
                constructor: Sortable,

                _onTapStart: function (/** Event|TouchEvent */evt) {
                    var _this = this,
                        el = this.el,
                        options = this.options,
                        type = evt.type,
                        touch = evt.touches && evt.touches[0],
                        target = (touch || evt).target,
                        originalTarget = target,
                        filter = options.filter;


                    if (type === 'mousedown' && evt.button !== 0 || options.disabled) {
                        return; // only left button or enabled
                    }

                    target = _closest(target, options.draggable, el);

                    if (!target) {
                        return;
                    }

                    // get the index of the dragged element within its parent
                    oldIndex = _index(target, options.draggable);

                    // Check filter
                    if (typeof filter === 'function') {
                        if (filter.call(this, evt, target, this)) {
                            _dispatchEvent(_this, originalTarget, 'filter', target, el, oldIndex);
                            evt.preventDefault();
                            return; // cancel dnd
                        }
                    } else if (filter) {
                        filter = filter.split(',').some(function (criteria) {
                            criteria = _closest(originalTarget, criteria.trim(), el);

                            if (criteria) {
                                _dispatchEvent(_this, criteria, 'filter', target, el, oldIndex);
                                return true;
                            }
                        });

                        if (filter) {
                            evt.preventDefault();
                            return; // cancel dnd
                        }
                    }


                    if (options.handle && !_closest(originalTarget, options.handle, el)) {
                        return;
                    }


                    // Prepare `dragstart`
                    this._prepareDragStart(evt, touch, target);
                },

                _prepareDragStart: function (/** Event */evt, /** Touch */touch, /** HTMLElement */target) {
                    var _this = this,
                        el = _this.el,
                        options = _this.options,
                        ownerDocument = el.ownerDocument,
                        dragStartFn;

                    if (target && !dragEl && (target.parentNode === el)) {
                        tapEvt = evt;

                        rootEl = el;
                        dragEl = target;
                        parentEl = dragEl.parentNode;
                        nextEl = dragEl.nextSibling;
                        activeGroup = options.group;

                        dragStartFn = function () {
                            // Delayed drag has been triggered
                            // we can re-enable the events: touchmove/mousemove
                            _this._disableDelayedDrag();

                            // Make the element draggable
                            dragEl.draggable = true;

                            // Chosen item
                            _toggleClass(dragEl, _this.options.chosenClass, true);

                            // Bind the events: dragstart/dragend
                            _this._triggerDragStart(touch);
                        };

                        // Disable "draggable"
                        options.ignore.split(',').forEach(function (criteria) {
                            _find(dragEl, criteria.trim(), _disableDraggable);
                        });

                        _on(ownerDocument, 'mouseup', _this._onDrop);
                        _on(ownerDocument, 'touchend', _this._onDrop);
                        _on(ownerDocument, 'touchcancel', _this._onDrop);

                        if (options.delay) {
                            // If the user moves the pointer or let go the click or touch
                            // before the delay has been reached:
                            // disable the delayed drag
                            _on(ownerDocument, 'mouseup', _this._disableDelayedDrag);
                            _on(ownerDocument, 'touchend', _this._disableDelayedDrag);
                            _on(ownerDocument, 'touchcancel', _this._disableDelayedDrag);
                            _on(ownerDocument, 'mousemove', _this._disableDelayedDrag);
                            _on(ownerDocument, 'touchmove', _this._disableDelayedDrag);

                            _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
                        } else {
                            dragStartFn();
                        }
                    }
                },

                _disableDelayedDrag: function () {
                    var ownerDocument = this.el.ownerDocument;

                    clearTimeout(this._dragStartTimer);
                    _off(ownerDocument, 'mouseup', this._disableDelayedDrag);
                    _off(ownerDocument, 'touchend', this._disableDelayedDrag);
                    _off(ownerDocument, 'touchcancel', this._disableDelayedDrag);
                    _off(ownerDocument, 'mousemove', this._disableDelayedDrag);
                    _off(ownerDocument, 'touchmove', this._disableDelayedDrag);
                },

                _triggerDragStart: function (/** Touch */touch) {
                    if (touch) {
                        // Touch device support
                        tapEvt = {
                            target: dragEl,
                            clientX: touch.clientX,
                            clientY: touch.clientY
                        };

                        this._onDragStart(tapEvt, 'touch');
                    } else if (!this.nativeDraggable) {
                        this._onDragStart(tapEvt, true);
                    } else {
                        _on(dragEl, 'dragend', this);
                        _on(rootEl, 'dragstart', this._onDragStart);
                    }

                    try {
                        if (document.selection) {
                            document.selection.empty();
                        } else {
                            window.getSelection().removeAllRanges();
                        }
                    } catch (err) {
                    }
                },

                _dragStarted: function () {
                    if (rootEl && dragEl) {
                        // Apply effect
                        _toggleClass(dragEl, this.options.ghostClass, true);

                        Sortable.active = this;

                        // Drag start event
                        _dispatchEvent(this, rootEl, 'start', dragEl, rootEl, oldIndex);
                    }
                },

                _emulateDragOver: function () {
                    if (touchEvt) {
                        if (this._lastX === touchEvt.clientX && this._lastY === touchEvt.clientY) {
                            return;
                        }

                        this._lastX = touchEvt.clientX;
                        this._lastY = touchEvt.clientY;

                        if (!supportCssPointerEvents) {
                            _css(ghostEl, 'display', 'none');
                        }

                        var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY),
                            parent = target,
                            groupName = ' ' + this.options.group.name + '',
                            i = touchDragOverListeners.length;

                        if (parent) {
                            do {
                                if (parent[expando] && parent[expando].options.groups.indexOf(groupName) > -1) {
                                    while (i--) {
                                        touchDragOverListeners[i]({
                                            clientX: touchEvt.clientX,
                                            clientY: touchEvt.clientY,
                                            target: target,
                                            rootEl: parent
                                        });
                                    }

                                    break;
                                }

                                target = parent; // store last element
                            }
                                /* jshint boss:true */
                            while (parent = parent.parentNode);
                        }

                        if (!supportCssPointerEvents) {
                            _css(ghostEl, 'display', '');
                        }
                    }
                },


                _onTouchMove: function (/**TouchEvent*/evt) {
                    if (tapEvt) {
                        // only set the status to dragging, when we are actually dragging
                        if (!Sortable.active) {
                            this._dragStarted();
                        }

                        // as well as creating the ghost element on the document body
                        this._appendGhost();

                        var touch = evt.touches ? evt.touches[0] : evt,
                            dx = touch.clientX - tapEvt.clientX,
                            dy = touch.clientY - tapEvt.clientY,
                            translate3d = evt.touches ? 'translate3d(' + dx + 'px,' + dy + 'px,0)' : 'translate(' + dx + 'px,' + dy + 'px)';

                        moved = true;
                        touchEvt = touch;

                        _css(ghostEl, 'webkitTransform', translate3d);
                        _css(ghostEl, 'mozTransform', translate3d);
                        _css(ghostEl, 'msTransform', translate3d);
                        _css(ghostEl, 'transform', translate3d);

                        evt.preventDefault();
                    }
                },

                _appendGhost: function () {
                    if (!ghostEl) {
                        var rect = dragEl.getBoundingClientRect(),
                            css = _css(dragEl),
                            options = this.options,
                            ghostRect;

                        ghostEl = dragEl.cloneNode(true);

                        _toggleClass(ghostEl, options.ghostClass, false);
                        _toggleClass(ghostEl, options.fallbackClass, true);

                        _css(ghostEl, 'top', rect.top - parseInt(css.marginTop, 10));
                        _css(ghostEl, 'left', rect.left - parseInt(css.marginLeft, 10));
                        _css(ghostEl, 'width', rect.width);
                        _css(ghostEl, 'height', rect.height);
                        _css(ghostEl, 'opacity', '0.8');
                        _css(ghostEl, 'position', 'fixed');
                        _css(ghostEl, 'zIndex', '100000');
                        _css(ghostEl, 'pointerEvents', 'none');

                        options.fallbackOnBody && document.body.appendChild(ghostEl) || rootEl.appendChild(ghostEl);

                        // Fixing dimensions.
                        ghostRect = ghostEl.getBoundingClientRect();
                        _css(ghostEl, 'width', rect.width * 2 - ghostRect.width);
                        _css(ghostEl, 'height', rect.height * 2 - ghostRect.height);
                    }
                },

                _onDragStart: function (/**Event*/evt, /**boolean*/useFallback) {
                    var dataTransfer = evt.dataTransfer,
                        options = this.options;

                    this._offUpEvents();

                    if (activeGroup.pull == 'clone') {
                        cloneEl = dragEl.cloneNode(true);
                        _css(cloneEl, 'display', 'none');
                        rootEl.insertBefore(cloneEl, dragEl);
                    }

                    if (useFallback) {

                        if (useFallback === 'touch') {
                            // Bind touch events
                            _on(document, 'touchmove', this._onTouchMove);
                            _on(document, 'touchend', this._onDrop);
                            _on(document, 'touchcancel', this._onDrop);
                        } else {
                            // Old brwoser
                            _on(document, 'mousemove', this._onTouchMove);
                            _on(document, 'mouseup', this._onDrop);
                        }

                        this._loopId = setInterval(this._emulateDragOver, 50);
                    } else {
                        if (dataTransfer) {
                            dataTransfer.effectAllowed = 'move';
                            options.setData && options.setData.call(this, dataTransfer, dragEl);
                        }

                        _on(document, 'drop', this);
                        setTimeout(this._dragStarted, 0);
                    }
                },

                _onDragOver: function (/**Event*/evt) {
                    var el = this.el,
                        target,
                        dragRect,
                        revert,
                        options = this.options,
                        group = options.group,
                        groupPut = group.put,
                        isOwner = (activeGroup === group),
                        canSort = options.sort;

                    if (evt.preventDefault !== void 0) {
                        evt.preventDefault();
                        !options.dragoverBubble && evt.stopPropagation();
                    }

                    moved = true;

                    if (activeGroup && !options.disabled &&
                        (isOwner
                                ? canSort || (revert = !rootEl.contains(dragEl)) // Reverting item into the original list
                                : activeGroup.pull && groupPut && (
                                (activeGroup.name === group.name) || // by Name
                                (groupPut.indexOf && ~groupPut.indexOf(activeGroup.name)) // by Array
                            )
                        ) &&
                        (evt.rootEl === void 0 || evt.rootEl === this.el) // touch fallback
                    ) {
                        // Smart auto-scrolling
                        _autoScroll(evt, options, this.el);

                        if (_silent) {
                            return;
                        }

                        target = _closest(evt.target, options.draggable, el);
                        dragRect = dragEl.getBoundingClientRect();

                        if (revert) {
                            _cloneHide(true);

                            if (cloneEl || nextEl) {
                                rootEl.insertBefore(dragEl, cloneEl || nextEl);
                            } else if (!canSort) {
                                rootEl.appendChild(dragEl);
                            }

                            return;
                        }


                        if ((el.children.length === 0) || (el.children[0] === ghostEl) ||
                            (el === evt.target) && (target = _ghostIsLast(el, evt))
                        ) {

                            if (target) {
                                if (target.animated) {
                                    return;
                                }

                                targetRect = target.getBoundingClientRect();
                            }

                            _cloneHide(isOwner);

                            if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect) !== false) {
                                if (!dragEl.contains(el)) {
                                    el.appendChild(dragEl);
                                    parentEl = el; // actualization
                                }

                                this._animate(dragRect, dragEl);
                                target && this._animate(targetRect, target);
                            }
                        } else if (target && !target.animated && target !== dragEl && (target.parentNode[expando] !== void 0)) {
                            if (lastEl !== target) {
                                lastEl = target;
                                lastCSS = _css(target);
                                lastParentCSS = _css(target.parentNode);
                            }


                            var targetRect = target.getBoundingClientRect(),
                                width = targetRect.right - targetRect.left,
                                height = targetRect.bottom - targetRect.top,
                                floating = /left|right|inline/.test(lastCSS.cssFloat + lastCSS.display)
                                    || (lastParentCSS.display == 'flex' && lastParentCSS['flex-direction'].indexOf('row') === 0),
                                isWide = (target.offsetWidth > dragEl.offsetWidth),
                                isLong = (target.offsetHeight > dragEl.offsetHeight),
                                halfway = (floating ? (evt.clientX - targetRect.left) / width : (evt.clientY - targetRect.top) / height) > 0.5,
                                nextSibling = target.nextElementSibling,
                                moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect),
                                after
                            ;

                            if (moveVector !== false) {
                                _silent = true;
                                setTimeout(_unsilent, 30);

                                _cloneHide(isOwner);

                                if (moveVector === 1 || moveVector === -1) {
                                    after = (moveVector === 1);
                                } else if (floating) {
                                    var elTop = dragEl.offsetTop,
                                        tgTop = target.offsetTop;

                                    if (elTop === tgTop) {
                                        after = (target.previousElementSibling === dragEl) && !isWide || halfway && isWide;
                                    } else {
                                        after = tgTop > elTop;
                                    }
                                } else {
                                    after = (nextSibling !== dragEl) && !isLong || halfway && isLong;
                                }

                                if (!dragEl.contains(el)) {
                                    if (after && !nextSibling) {
                                        el.appendChild(dragEl);
                                    } else {
                                        target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
                                    }
                                }

                                parentEl = dragEl.parentNode; // actualization

                                this._animate(dragRect, dragEl);
                                this._animate(targetRect, target);
                            }
                        }
                    }
                },

                _animate: function (prevRect, target) {
                    var ms = this.options.animation;

                    if (ms) {
                        var currentRect = target.getBoundingClientRect();

                        _css(target, 'transition', 'none');
                        _css(target, 'transform', 'translate3d('
                            + (prevRect.left - currentRect.left) + 'px,'
                            + (prevRect.top - currentRect.top) + 'px,0)'
                        );

                        target.offsetWidth; // repaint

                        _css(target, 'transition', 'all ' + ms + 'ms');
                        _css(target, 'transform', 'translate3d(0,0,0)');

                        clearTimeout(target.animated);
                        target.animated = setTimeout(function () {
                            _css(target, 'transition', '');
                            _css(target, 'transform', '');
                            target.animated = false;
                        }, ms);
                    }
                },

                _offUpEvents: function () {
                    var ownerDocument = this.el.ownerDocument;

                    _off(document, 'touchmove', this._onTouchMove);
                    _off(ownerDocument, 'mouseup', this._onDrop);
                    _off(ownerDocument, 'touchend', this._onDrop);
                    _off(ownerDocument, 'touchcancel', this._onDrop);
                },

                _onDrop: function (/**Event*/evt) {
                    var el = this.el,
                        options = this.options;

                    clearInterval(this._loopId);
                    clearInterval(autoScroll.pid);
                    clearTimeout(this._dragStartTimer);

                    // Unbind events
                    _off(document, 'mousemove', this._onTouchMove);

                    if (this.nativeDraggable) {
                        _off(document, 'drop', this);
                        _off(el, 'dragstart', this._onDragStart);
                    }

                    this._offUpEvents();

                    if (evt) {
                        if (moved) {
                            evt.preventDefault();
                            !options.dropBubble && evt.stopPropagation();
                        }

                        ghostEl && ghostEl.parentNode.removeChild(ghostEl);

                        if (dragEl) {
                            if (this.nativeDraggable) {
                                _off(dragEl, 'dragend', this);
                            }

                            _disableDraggable(dragEl);

                            // Remove class's
                            _toggleClass(dragEl, this.options.ghostClass, false);
                            _toggleClass(dragEl, this.options.chosenClass, false);

                            if (rootEl !== parentEl) {
                                newIndex = _index(dragEl, options.draggable);

                                if (newIndex >= 0) {
                                    // drag from one list and drop into another
                                    _dispatchEvent(null, parentEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
                                    _dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);

                                    // Add event
                                    _dispatchEvent(null, parentEl, 'add', dragEl, rootEl, oldIndex, newIndex);

                                    // Remove event
                                    _dispatchEvent(this, rootEl, 'remove', dragEl, rootEl, oldIndex, newIndex);
                                }
                            } else {
                                // Remove clone
                                cloneEl && cloneEl.parentNode.removeChild(cloneEl);

                                if (dragEl.nextSibling !== nextEl) {
                                    // Get the index of the dragged element within its parent
                                    newIndex = _index(dragEl, options.draggable);

                                    if (newIndex >= 0) {
                                        // drag & drop within the same list
                                        _dispatchEvent(this, rootEl, 'update', dragEl, rootEl, oldIndex, newIndex);
                                        _dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
                                    }
                                }
                            }

                            if (Sortable.active) {
                                if (newIndex === null || newIndex === -1) {
                                    newIndex = oldIndex;
                                }

                                _dispatchEvent(this, rootEl, 'end', dragEl, rootEl, oldIndex, newIndex);

                                // Save sorting
                                this.save();
                            }
                        }

                        // Nulling
                        rootEl =
                            dragEl =
                                parentEl =
                                    ghostEl =
                                        nextEl =
                                            cloneEl =

                                                scrollEl =
                                                    scrollParentEl =

                                                        tapEvt =
                                                            touchEvt =

                                                                moved =
                                                                    newIndex =

                                                                        lastEl =
                                                                            lastCSS =

                                                                                activeGroup =
                                                                                    Sortable.active = null;
                    }
                },


                handleEvent: function (/**Event*/evt) {
                    var type = evt.type;

                    if (type === 'dragover' || type === 'dragenter') {
                        if (dragEl) {
                            this._onDragOver(evt);
                            _globalDragOver(evt);
                        }
                    } else if (type === 'drop' || type === 'dragend') {
                        this._onDrop(evt);
                    }
                },


                /**
                 * Serializes the item into an array of string.
                 * @returns {String[]}
                 */
                toArray: function () {
                    var order = [],
                        el,
                        children = this.el.children,
                        i = 0,
                        n = children.length,
                        options = this.options;

                    for (; i < n; i++) {
                        el = children[i];
                        if (_closest(el, options.draggable, this.el)) {
                            order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
                        }
                    }

                    return order;
                },


                /**
                 * Sorts the elements according to the array.
                 * @param  {String[]}  order  order of the items
                 */
                sort: function (order) {
                    var items = {}, rootEl = this.el;

                    this.toArray().forEach(function (id, i) {
                        var el = rootEl.children[i];

                        if (_closest(el, this.options.draggable, rootEl)) {
                            items[id] = el;
                        }
                    }, this);

                    order.forEach(function (id) {
                        if (items[id]) {
                            rootEl.removeChild(items[id]);
                            rootEl.appendChild(items[id]);
                        }
                    });
                },


                /**
                 * Save the current sorting
                 */
                save: function () {
                    var store = this.options.store;
                    store && store.set(this);
                },


                /**
                 * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
                 * @param   {HTMLElement}  el
                 * @param   {String}       [selector]  default: `options.draggable`
                 * @returns {HTMLElement|null}
                 */
                closest: function (el, selector) {
                    return _closest(el, selector || this.options.draggable, this.el);
                },


                /**
                 * Set/get option
                 * @param   {string} name
                 * @param   {*}      [value]
                 * @returns {*}
                 */
                option: function (name, value) {
                    var options = this.options;

                    if (value === void 0) {
                        return options[name];
                    } else {
                        options[name] = value;

                        if (name === 'group') {
                            _prepareGroup(options);
                        }
                    }
                },


                /**
                 * Destroy
                 */
                destroy: function () {
                    var el = this.el;

                    el[expando] = null;

                    _off(el, 'mousedown', this._onTapStart);
                    _off(el, 'touchstart', this._onTapStart);

                    if (this.nativeDraggable) {
                        _off(el, 'dragover', this);
                        _off(el, 'dragenter', this);
                    }

                    // Remove draggable attributes
                    Array.prototype.forEach.call(el.querySelectorAll('[draggable]'), function (el) {
                        el.removeAttribute('draggable');
                    });

                    touchDragOverListeners.splice(touchDragOverListeners.indexOf(this._onDragOver), 1);

                    this._onDrop();

                    this.el = el = null;
                }
            };


            function _cloneHide(state) {
                if (cloneEl && (cloneEl.state !== state)) {
                    _css(cloneEl, 'display', state ? 'none' : '');
                    !state && cloneEl.state && rootEl.insertBefore(cloneEl, dragEl);
                    cloneEl.state = state;
                }
            }


            function _closest(/**HTMLElement*/el, /**String*/selector, /**HTMLElement*/ctx) {
                if (el) {
                    ctx = ctx || document;

                    do {
                        if (
                            (selector === '>*' && el.parentNode === ctx)
                            || _matches(el, selector)
                        ) {
                            return el;
                        }
                    }
                    while (el !== ctx && (el = el.parentNode));
                }

                return null;
            }


            function _globalDragOver(/**Event*/evt) {
                if (evt.dataTransfer) {
                    evt.dataTransfer.dropEffect = 'move';
                }
                evt.preventDefault();
            }


            function _on(el, event, fn) {
                el.addEventListener(event, fn, false);
            }


            function _off(el, event, fn) {
                el.removeEventListener(event, fn, false);
            }


            function _toggleClass(el, name, state) {
                if (el) {
                    if (el.classList) {
                        el.classList[state ? 'add' : 'remove'](name);
                    } else {
                        var className = (' ' + el.className + ' ').replace(RSPACE, ' ').replace(' ' + name + ' ', ' ');
                        el.className = (className + (state ? ' ' + name : '')).replace(RSPACE, ' ');
                    }
                }
            }


            function _css(el, prop, val) {
                var style = el && el.style;

                if (style) {
                    if (val === void 0) {
                        if (document.defaultView && document.defaultView.getComputedStyle) {
                            val = document.defaultView.getComputedStyle(el, '');
                        } else if (el.currentStyle) {
                            val = el.currentStyle;
                        }

                        return prop === void 0 ? val : val[prop];
                    } else {
                        if (!(prop in style)) {
                            prop = '-webkit-' + prop;
                        }

                        style[prop] = val + (typeof val === 'string' ? '' : 'px');
                    }
                }
            }


            function _find(ctx, tagName, iterator) {
                if (ctx) {
                    var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;

                    if (iterator) {
                        for (; i < n; i++) {
                            iterator(list[i], i);
                        }
                    }

                    return list;
                }

                return [];
            }


            function _dispatchEvent(sortable, rootEl, name, targetEl, fromEl, startIndex, newIndex) {
                var evt = document.createEvent('Event'),
                    options = (sortable || rootEl[expando]).options,
                    onName = 'on' + name.charAt(0).toUpperCase() + name.substr(1);

                evt.initEvent(name, true, true);

                evt.to = rootEl;
                evt.from = fromEl || rootEl;
                evt.item = targetEl || rootEl;
                evt.clone = cloneEl;

                evt.oldIndex = startIndex;
                evt.newIndex = newIndex;

                rootEl.dispatchEvent(evt);

                if (options[onName]) {
                    options[onName].call(sortable, evt);
                }
            }


            function _onMove(fromEl, toEl, dragEl, dragRect, targetEl, targetRect) {
                var evt,
                    sortable = fromEl[expando],
                    onMoveFn = sortable.options.onMove,
                    retVal;

                evt = document.createEvent('Event');
                evt.initEvent('move', true, true);

                evt.to = toEl;
                evt.from = fromEl;
                evt.dragged = dragEl;
                evt.draggedRect = dragRect;
                evt.related = targetEl || toEl;
                evt.relatedRect = targetRect || toEl.getBoundingClientRect();

                fromEl.dispatchEvent(evt);

                if (onMoveFn) {
                    retVal = onMoveFn.call(sortable, evt);
                }

                return retVal;
            }


            function _disableDraggable(el) {
                el.draggable = false;
            }


            function _unsilent() {
                _silent = false;
            }


            /** @returns {HTMLElement|false} */
            function _ghostIsLast(el, evt) {
                var lastEl = el.lastElementChild,
                    rect = lastEl.getBoundingClientRect();

                return ((evt.clientY - (rect.top + rect.height) > 5) || (evt.clientX - (rect.right + rect.width) > 5)) && lastEl; // min delta
            }


            /**
             * Generate id
             * @param   {HTMLElement} el
             * @returns {String}
             * @private
             */
            function _generateId(el) {
                var str = el.tagName + el.className + el.src + el.href + el.textContent,
                    i = str.length,
                    sum = 0;

                while (i--) {
                    sum += str.charCodeAt(i);
                }

                return sum.toString(36);
            }

            /**
             * Returns the index of an element within its parent for a selected set of
             * elements
             * @param  {HTMLElement} el
             * @param  {selector} selector
             * @return {number}
             */
            function _index(el, selector) {
                var index = 0;

                if (!el || !el.parentNode) {
                    return -1;
                }

                while (el && (el = el.previousElementSibling)) {
                    if (el.nodeName.toUpperCase() !== 'TEMPLATE'
                        && _matches(el, selector)) {
                        index++;
                    }
                }

                return index;
            }

            function _matches(/**HTMLElement*/el, /**String*/selector) {
                if (el) {
                    selector = selector.split('.');

                    var tag = selector.shift().toUpperCase(),
                        re = new RegExp('\\s(' + selector.join('|') + ')(?=\\s)', 'g');

                    return (
                        (tag === '' || el.nodeName.toUpperCase() == tag) &&
                        (!selector.length || ((' ' + el.className + ' ').match(re) || []).length == selector.length)
                    );
                }

                return false;
            }

            function _throttle(callback, ms) {
                var args, _this;

                return function () {
                    if (args === void 0) {
                        args = arguments;
                        _this = this;

                        setTimeout(function () {
                            if (args.length === 1) {
                                callback.call(_this, args[0]);
                            } else {
                                callback.apply(_this, args);
                            }

                            args = void 0;
                        }, ms);
                    }
                };
            }

            function _extend(dst, src) {
                if (dst && src) {
                    for (var key in src) {
                        if (src.hasOwnProperty(key)) {
                            dst[key] = src[key];
                        }
                    }
                }

                return dst;
            }


            // Export utils
            Sortable.utils = {
                on: _on,
                off: _off,
                css: _css,
                find: _find,
                is: function (el, selector) {
                    return !!_closest(el, selector, el);
                },
                extend: _extend,
                throttle: _throttle,
                closest: _closest,
                toggleClass: _toggleClass,
                index: _index
            };


            /**
             * Create sortable instance
             * @param {HTMLElement}  el
             * @param {Object}      [options]
             */
            Sortable.create = function (el, options) {
                return new Sortable(el, options);
            };


            // Export
            Sortable.version = '1.4.2';
            return Sortable;
        });

    }, {}], 25: [function (require, module, exports) {
        (function (global) {
            /*!
 * clipboard.js v1.5.5
 * https://zenorocha.github.io/clipboard.js
 *
 * Licensed MIT © Zeno Rocha
 */
            !function (t) {
                if ("object" == typeof exports && "undefined" != typeof module) module.exports = t(); else if ("function" == typeof define && define.amd) define([], t); else {
                    var e;
                    e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this, e.Clipboard = t()
                }
            }(function () {
                var t, e, n;
                return function t(e, n, r) {
                    function o(a, c) {
                        if (!n[a]) {
                            if (!e[a]) {
                                var s = "function" == typeof require && require;
                                if (!c && s) return s(a, !0);
                                if (i) return i(a, !0);
                                var u = new Error("Cannot find module '" + a + "'");
                                throw u.code = "MODULE_NOT_FOUND", u
                            }
                            var l = n[a] = {exports: {}};
                            e[a][0].call(l.exports, function (t) {
                                var n = e[a][1][t];
                                return o(n ? n : t)
                            }, l, l.exports, t, e, n, r)
                        }
                        return n[a].exports
                    }

                    for (var i = "function" == typeof require && require, a = 0; a < r.length; a++) o(r[a]);
                    return o
                }({
                    1: [function (t, e, n) {
                        var r = t("matches-selector");
                        e.exports = function (t, e, n) {
                            for (var o = n ? t : t.parentNode; o && o !== document;) {
                                if (r(o, e)) return o;
                                o = o.parentNode
                            }
                        }
                    }, {"matches-selector": 2}], 2: [function (t, e, n) {
                        function r(t, e) {
                            if (i) return i.call(t, e);
                            for (var n = t.parentNode.querySelectorAll(e), r = 0; r < n.length; ++r) if (n[r] == t) return !0;
                            return !1
                        }

                        var o = Element.prototype, i = o.matchesSelector || o.webkitMatchesSelector || o.mozMatchesSelector || o.msMatchesSelector || o.oMatchesSelector;
                        e.exports = r
                    }, {}], 3: [function (t, e, n) {
                        function r(t, e, n, r) {
                            var i = o.apply(this, arguments);
                            return t.addEventListener(n, i), {
                                destroy: function () {
                                    t.removeEventListener(n, i)
                                }
                            }
                        }

                        function o(t, e, n, r) {
                            return function (n) {
                                n.delegateTarget = i(n.target, e, !0), n.delegateTarget && r.call(t, n)
                            }
                        }

                        var i = t("closest");
                        e.exports = r
                    }, {closest: 1}], 4: [function (t, e, n) {
                        n.node = function (t) {
                            return void 0 !== t && t instanceof HTMLElement && 1 === t.nodeType
                        }, n.nodeList = function (t) {
                            var e = Object.prototype.toString.call(t);
                            return void 0 !== t && ("[object NodeList]" === e || "[object HTMLCollection]" === e) && "length" in t && (0 === t.length || n.node(t[0]))
                        }, n.string = function (t) {
                            return "string" == typeof t || t instanceof String
                        }, n.function = function (t) {
                            var e = Object.prototype.toString.call(t);
                            return "[object Function]" === e
                        }
                    }, {}], 5: [function (t, e, n) {
                        function r(t, e, n) {
                            if (!t && !e && !n) throw new Error("Missing required arguments");
                            if (!c.string(e)) throw new TypeError("Second argument must be a String");
                            if (!c.function(n)) throw new TypeError("Third argument must be a Function");
                            if (c.node(t)) return o(t, e, n);
                            if (c.nodeList(t)) return i(t, e, n);
                            if (c.string(t)) return a(t, e, n);
                            throw new TypeError("First argument must be a String, HTMLElement, HTMLCollection, or NodeList")
                        }

                        function o(t, e, n) {
                            return t.addEventListener(e, n), {
                                destroy: function () {
                                    t.removeEventListener(e, n)
                                }
                            }
                        }

                        function i(t, e, n) {
                            return Array.prototype.forEach.call(t, function (t) {
                                t.addEventListener(e, n)
                            }), {
                                destroy: function () {
                                    Array.prototype.forEach.call(t, function (t) {
                                        t.removeEventListener(e, n)
                                    })
                                }
                            }
                        }

                        function a(t, e, n) {
                            return s(document.body, t, e, n)
                        }

                        var c = t("./is"), s = t("delegate");
                        e.exports = r
                    }, {"./is": 4, delegate: 3}], 6: [function (t, e, n) {
                        function r(t) {
                            var e;
                            if ("INPUT" === t.nodeName || "TEXTAREA" === t.nodeName) t.focus(), t.setSelectionRange(0, t.value.length), e = t.value; else {
                                t.hasAttribute("contenteditable") && t.focus();
                                var n = window.getSelection(), r = document.createRange();
                                r.selectNodeContents(t), n.removeAllRanges(), n.addRange(r), e = n.toString()
                            }
                            return e
                        }

                        e.exports = r
                    }, {}], 7: [function (t, e, n) {
                        function r() {
                        }

                        r.prototype = {
                            on: function (t, e, n) {
                                var r = this.e || (this.e = {});
                                return (r[t] || (r[t] = [])).push({fn: e, ctx: n}), this
                            }, once: function (t, e, n) {
                                function r() {
                                    o.off(t, r), e.apply(n, arguments)
                                }

                                var o = this;
                                return r._ = e, this.on(t, r, n)
                            }, emit: function (t) {
                                var e = [].slice.call(arguments, 1), n = ((this.e || (this.e = {}))[t] || []).slice(), r = 0, o = n.length;
                                for (r; o > r; r++) n[r].fn.apply(n[r].ctx, e);
                                return this
                            }, off: function (t, e) {
                                var n = this.e || (this.e = {}), r = n[t], o = [];
                                if (r && e) for (var i = 0, a = r.length; a > i; i++) r[i].fn !== e && r[i].fn._ !== e && o.push(r[i]);
                                return o.length ? n[t] = o : delete n[t], this
                            }
                        }, e.exports = r
                    }, {}], 8: [function (t, e, n) {
                        "use strict";

                        function r(t) {
                            return t && t.__esModule ? t : {"default": t}
                        }

                        function o(t, e) {
                            if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
                        }

                        n.__esModule = !0;
                        var i = function () {
                            function t(t, e) {
                                for (var n = 0; n < e.length; n++) {
                                    var r = e[n];
                                    r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(t, r.key, r)
                                }
                            }

                            return function (e, n, r) {
                                return n && t(e.prototype, n), r && t(e, r), e
                            }
                        }(), a = t("select"), c = r(a), s = function () {
                            function t(e) {
                                o(this, t), this.resolveOptions(e), this.initSelection()
                            }

                            return t.prototype.resolveOptions = function t() {
                                var e = arguments.length <= 0 || void 0 === arguments[0] ? {} : arguments[0];
                                this.action = e.action, this.emitter = e.emitter, this.target = e.target, this.text = e.text, this.trigger = e.trigger, this.selectedText = ""
                            }, t.prototype.initSelection = function t() {
                                if (this.text && this.target) throw new Error('Multiple attributes declared, use either "target" or "text"');
                                if (this.text) this.selectFake(); else {
                                    if (!this.target) throw new Error('Missing required attributes, use either "target" or "text"');
                                    this.selectTarget()
                                }
                            }, t.prototype.selectFake = function t() {
                                var e = this;
                                this.removeFake(), this.fakeHandler = document.body.addEventListener("click", function () {
                                    return e.removeFake()
                                }), this.fakeElem = document.createElement("textarea"), this.fakeElem.style.position = "absolute", this.fakeElem.style.left = "-9999px", this.fakeElem.style.top = (window.pageYOffset || document.documentElement.scrollTop) + "px", this.fakeElem.setAttribute("readonly", ""), this.fakeElem.value = this.text, document.body.appendChild(this.fakeElem), this.selectedText = c.default(this.fakeElem), this.copyText()
                            }, t.prototype.removeFake = function t() {
                                this.fakeHandler && (document.body.removeEventListener("click"), this.fakeHandler = null), this.fakeElem && (document.body.removeChild(this.fakeElem), this.fakeElem = null)
                            }, t.prototype.selectTarget = function t() {
                                this.selectedText = c.default(this.target), this.copyText()
                            }, t.prototype.copyText = function t() {
                                var e = void 0;
                                try {
                                    e = document.execCommand(this.action)
                                } catch (n) {
                                    e = !1
                                }
                                this.handleResult(e)
                            }, t.prototype.handleResult = function t(e) {
                                e ? this.emitter.emit("success", {action: this.action, text: this.selectedText, trigger: this.trigger, clearSelection: this.clearSelection.bind(this)}) : this.emitter.emit("error", {action: this.action, trigger: this.trigger, clearSelection: this.clearSelection.bind(this)})
                            }, t.prototype.clearSelection = function t() {
                                this.target && this.target.blur(), window.getSelection().removeAllRanges()
                            }, t.prototype.destroy = function t() {
                                this.removeFake()
                            }, i(t, [{
                                key: "action", set: function t() {
                                    var e = arguments.length <= 0 || void 0 === arguments[0] ? "copy" : arguments[0];
                                    if (this._action = e, "copy" !== this._action && "cut" !== this._action) throw new Error('Invalid "action" value, use either "copy" or "cut"')
                                }, get: function t() {
                                    return this._action
                                }
                            }, {
                                key: "target", set: function t(e) {
                                    if (void 0 !== e) {
                                        if (!e || "object" != typeof e || 1 !== e.nodeType) throw new Error('Invalid "target" value, use a valid Element');
                                        this._target = e
                                    }
                                }, get: function t() {
                                    return this._target
                                }
                            }]), t
                        }();
                        n.default = s, e.exports = n.default
                    }, {select: 6}], 9: [function (t, e, n) {
                        "use strict";

                        function r(t) {
                            return t && t.__esModule ? t : {"default": t}
                        }

                        function o(t, e) {
                            if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
                        }

                        function i(t, e) {
                            if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function, not " + typeof e);
                            t.prototype = Object.create(e && e.prototype, {constructor: {value: t, enumerable: !1, writable: !0, configurable: !0}}), e && (Object.setPrototypeOf ? Object.setPrototypeOf(t, e) : t.__proto__ = e)
                        }

                        function a(t, e) {
                            var n = "data-clipboard-" + t;
                            if (e.hasAttribute(n)) return e.getAttribute(n)
                        }

                        n.__esModule = !0;
                        var c = t("./clipboard-action"), s = r(c), u = t("tiny-emitter"), l = r(u), f = t("good-listener"), d = r(f), h = function (t) {
                            function e(n, r) {
                                o(this, e), t.call(this), this.resolveOptions(r), this.listenClick(n)
                            }

                            return i(e, t), e.prototype.resolveOptions = function t() {
                                var e = arguments.length <= 0 || void 0 === arguments[0] ? {} : arguments[0];
                                this.action = "function" == typeof e.action ? e.action : this.defaultAction, this.target = "function" == typeof e.target ? e.target : this.defaultTarget, this.text = "function" == typeof e.text ? e.text : this.defaultText
                            }, e.prototype.listenClick = function t(e) {
                                var n = this;
                                this.listener = d.default(e, "click", function (t) {
                                    return n.onClick(t)
                                })
                            }, e.prototype.onClick = function t(e) {
                                var n = e.delegateTarget || e.currentTarget;
                                this.clipboardAction && (this.clipboardAction = null), this.clipboardAction = new s.default({action: this.action(n), target: this.target(n), text: this.text(n), trigger: n, emitter: this})
                            }, e.prototype.defaultAction = function t(e) {
                                return a("action", e)
                            }, e.prototype.defaultTarget = function t(e) {
                                var n = a("target", e);
                                return n ? document.querySelector(n) : void 0
                            }, e.prototype.defaultText = function t(e) {
                                return a("text", e)
                            }, e.prototype.destroy = function t() {
                                this.listener.destroy(), this.clipboardAction && (this.clipboardAction.destroy(), this.clipboardAction = null)
                            }, e
                        }(l.default);
                        n.default = h, e.exports = n.default
                    }, {"./clipboard-action": 8, "good-listener": 5, "tiny-emitter": 7}]
                }, {}, [9])(9)
            });
        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {}], 26: [function (require, module, exports) {
        (function (global, Buffer) {
            /*!

JSZip - A Javascript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2014 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/master/LICENSE
*/
            !function (a) {
                if ("object" == typeof exports && "undefined" != typeof module) module.exports = a(); else if ("function" == typeof define && define.amd) define([], a); else {
                    var b;
                    "undefined" != typeof window ? b = window : "undefined" != typeof global ? b = global : "undefined" != typeof self && (b = self), b.JSZip = a()
                }
            }(function () {
                return function a(b, c, d) {
                    function e(g, h) {
                        if (!c[g]) {
                            if (!b[g]) {
                                var i = "function" == typeof require && require;
                                if (!h && i) return i(g, !0);
                                if (f) return f(g, !0);
                                throw new Error("Cannot find module '" + g + "'")
                            }
                            var j = c[g] = {exports: {}};
                            b[g][0].call(j.exports, function (a) {
                                var c = b[g][1][a];
                                return e(c ? c : a)
                            }, j, j.exports, a, b, c, d)
                        }
                        return c[g].exports
                    }

                    for (var f = "function" == typeof require && require, g = 0; g < d.length; g++) e(d[g]);
                    return e
                }({
                    1: [function (a, b, c) {
                        "use strict";
                        var d = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
                        c.encode = function (a) {
                            for (var b, c, e, f, g, h, i, j = "", k = 0; k < a.length;) b = a.charCodeAt(k++), c = a.charCodeAt(k++), e = a.charCodeAt(k++), f = b >> 2, g = (3 & b) << 4 | c >> 4, h = (15 & c) << 2 | e >> 6, i = 63 & e, isNaN(c) ? h = i = 64 : isNaN(e) && (i = 64), j = j + d.charAt(f) + d.charAt(g) + d.charAt(h) + d.charAt(i);
                            return j
                        }, c.decode = function (a) {
                            var b, c, e, f, g, h, i, j = "", k = 0;
                            for (a = a.replace(/[^A-Za-z0-9\+\/\=]/g, ""); k < a.length;) f = d.indexOf(a.charAt(k++)), g = d.indexOf(a.charAt(k++)), h = d.indexOf(a.charAt(k++)), i = d.indexOf(a.charAt(k++)), b = f << 2 | g >> 4, c = (15 & g) << 4 | h >> 2, e = (3 & h) << 6 | i, j += String.fromCharCode(b), 64 != h && (j += String.fromCharCode(c)), 64 != i && (j += String.fromCharCode(e));
                            return j
                        }
                    }, {}], 2: [function (a, b) {
                        "use strict";

                        function c() {
                            this.compressedSize = 0, this.uncompressedSize = 0, this.crc32 = 0, this.compressionMethod = null, this.compressedContent = null
                        }

                        c.prototype = {
                            getContent: function () {
                                return null
                            }, getCompressedContent: function () {
                                return null
                            }
                        }, b.exports = c
                    }, {}], 3: [function (a, b, c) {
                        "use strict";
                        c.STORE = {
                            magic: "\x00\x00", compress: function (a) {
                                return a
                            }, uncompress: function (a) {
                                return a
                            }, compressInputType: null, uncompressInputType: null
                        }, c.DEFLATE = a("./flate")
                    }, {"./flate": 8}], 4: [function (a, b) {
                        "use strict";
                        var c = a("./utils"),
                            d = [0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685, 2657392035, 249268274, 2044508324, 3772115230, 2547177864, 162941995, 2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648, 2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990, 1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755, 2366115317, 997073096, 1281953886, 3579855332, 2724688242, 1006888145, 1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206, 2898065728, 853044451, 1172266101, 3705015759, 2882616665, 651767980, 1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705, 3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527, 1483230225, 3244367275, 3060149565, 1994146192, 31158534, 2563907772, 4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290, 251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719, 3865271297, 1802195444, 476864866, 2238001368, 4066508878, 1812370925, 453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202, 4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960, 984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733, 3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467, 855842277, 2852801631, 3708648649, 1342533948, 654459306, 3188396048, 3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054, 702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443, 3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945, 2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430, 2053790376, 3826175755, 2466906013, 167816743, 2097651377, 4027552580, 2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225, 1852507879, 4275313526, 2312317920, 282753626, 1742555852, 4189708143, 2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732, 1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850, 2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135, 1181335161, 3412177804, 3160834842, 628085408, 1382605366, 3423369109, 3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954, 1555261956, 3268935591, 3050360625, 752459403, 1541320221, 2607071920, 3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877, 83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603, 3855990285, 2094854071, 198958881, 2262029012, 4057260610, 1759359992, 534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934, 4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795, 376229701, 2685067896, 3608007406, 1308918612, 956543938, 2808555105, 3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270, 936918e3, 2847714899, 3736837829, 1202900863, 817233897, 3183342108, 3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449, 601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471, 3272380065, 1510334235, 755167117];
                        b.exports = function (a, b) {
                            if ("undefined" == typeof a || !a.length) return 0;
                            var e = "string" !== c.getTypeOf(a);
                            "undefined" == typeof b && (b = 0);
                            var f = 0, g = 0, h = 0;
                            b = -1 ^ b;
                            for (var i = 0, j = a.length; j > i; i++) h = e ? a[i] : a.charCodeAt(i), g = 255 & (b ^ h), f = d[g], b = b >>> 8 ^ f;
                            return -1 ^ b
                        }
                    }, {"./utils": 21}], 5: [function (a, b) {
                        "use strict";

                        function c() {
                            this.data = null, this.length = 0, this.index = 0
                        }

                        var d = a("./utils");
                        c.prototype = {
                            checkOffset: function (a) {
                                this.checkIndex(this.index + a)
                            }, checkIndex: function (a) {
                                if (this.length < a || 0 > a) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + a + "). Corrupted zip ?")
                            }, setIndex: function (a) {
                                this.checkIndex(a), this.index = a
                            }, skip: function (a) {
                                this.setIndex(this.index + a)
                            }, byteAt: function () {
                            }, readInt: function (a) {
                                var b, c = 0;
                                for (this.checkOffset(a), b = this.index + a - 1; b >= this.index; b--) c = (c << 8) + this.byteAt(b);
                                return this.index += a, c
                            }, readString: function (a) {
                                return d.transformTo("string", this.readData(a))
                            }, readData: function () {
                            }, lastIndexOfSignature: function () {
                            }, readDate: function () {
                                var a = this.readInt(4);
                                return new Date((a >> 25 & 127) + 1980, (a >> 21 & 15) - 1, a >> 16 & 31, a >> 11 & 31, a >> 5 & 63, (31 & a) << 1)
                            }
                        }, b.exports = c
                    }, {"./utils": 21}], 6: [function (a, b, c) {
                        "use strict";
                        c.base64 = !1, c.binary = !1, c.dir = !1, c.createFolders = !1, c.date = null, c.compression = null, c.compressionOptions = null, c.comment = null, c.unixPermissions = null, c.dosPermissions = null
                    }, {}], 7: [function (a, b, c) {
                        "use strict";
                        var d = a("./utils");
                        c.string2binary = function (a) {
                            return d.string2binary(a)
                        }, c.string2Uint8Array = function (a) {
                            return d.transformTo("uint8array", a)
                        }, c.uint8Array2String = function (a) {
                            return d.transformTo("string", a)
                        }, c.string2Blob = function (a) {
                            var b = d.transformTo("arraybuffer", a);
                            return d.arrayBuffer2Blob(b)
                        }, c.arrayBuffer2Blob = function (a) {
                            return d.arrayBuffer2Blob(a)
                        }, c.transformTo = function (a, b) {
                            return d.transformTo(a, b)
                        }, c.getTypeOf = function (a) {
                            return d.getTypeOf(a)
                        }, c.checkSupport = function (a) {
                            return d.checkSupport(a)
                        }, c.MAX_VALUE_16BITS = d.MAX_VALUE_16BITS, c.MAX_VALUE_32BITS = d.MAX_VALUE_32BITS, c.pretty = function (a) {
                            return d.pretty(a)
                        }, c.findCompression = function (a) {
                            return d.findCompression(a)
                        }, c.isRegExp = function (a) {
                            return d.isRegExp(a)
                        }
                    }, {"./utils": 21}], 8: [function (a, b, c) {
                        "use strict";
                        var d = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, e = a("pako");
                        c.uncompressInputType = d ? "uint8array" : "array", c.compressInputType = d ? "uint8array" : "array", c.magic = "\b\x00", c.compress = function (a, b) {
                            return e.deflateRaw(a, {level: b.level || -1})
                        }, c.uncompress = function (a) {
                            return e.inflateRaw(a)
                        }
                    }, {pako: 24}], 9: [function (a, b) {
                        "use strict";

                        function c(a, b) {
                            return this instanceof c ? (this.files = {}, this.comment = null, this.root = "", a && this.load(a, b), void (this.clone = function () {
                                var a = new c;
                                for (var b in this) "function" != typeof this[b] && (a[b] = this[b]);
                                return a
                            })) : new c(a, b)
                        }

                        var d = a("./base64");
                        c.prototype = a("./object"), c.prototype.load = a("./load"), c.support = a("./support"), c.defaults = a("./defaults"), c.utils = a("./deprecatedPublicUtils"), c.base64 = {
                            encode: function (a) {
                                return d.encode(a)
                            }, decode: function (a) {
                                return d.decode(a)
                            }
                        }, c.compressions = a("./compressions"), b.exports = c
                    }, {"./base64": 1, "./compressions": 3, "./defaults": 6, "./deprecatedPublicUtils": 7, "./load": 10, "./object": 13, "./support": 17}], 10: [function (a, b) {
                        "use strict";
                        var c = a("./base64"), d = a("./zipEntries");
                        b.exports = function (a, b) {
                            var e, f, g, h;
                            for (b = b || {}, b.base64 && (a = c.decode(a)), f = new d(a, b), e = f.files, g = 0; g < e.length; g++) h = e[g], this.file(h.fileName, h.decompressed, {binary: !0, optimizedBinaryString: !0, date: h.date, dir: h.dir, comment: h.fileComment.length ? h.fileComment : null, unixPermissions: h.unixPermissions, dosPermissions: h.dosPermissions, createFolders: b.createFolders});
                            return f.zipComment.length && (this.comment = f.zipComment), this
                        }
                    }, {"./base64": 1, "./zipEntries": 22}], 11: [function (a, b) {
                        (function (a) {
                            "use strict";
                            b.exports = function (b, c) {
                                return new a(b, c)
                            }, b.exports.test = function (b) {
                                return a.isBuffer(b)
                            }
                        }).call(this, "undefined" != typeof Buffer ? Buffer : void 0)
                    }, {}], 12: [function (a, b) {
                        "use strict";

                        function c(a) {
                            this.data = a, this.length = this.data.length, this.index = 0
                        }

                        var d = a("./uint8ArrayReader");
                        c.prototype = new d, c.prototype.readData = function (a) {
                            this.checkOffset(a);
                            var b = this.data.slice(this.index, this.index + a);
                            return this.index += a, b
                        }, b.exports = c
                    }, {"./uint8ArrayReader": 18}], 13: [function (a, b) {
                        "use strict";
                        var c = a("./support"), d = a("./utils"), e = a("./crc32"), f = a("./signature"), g = a("./defaults"), h = a("./base64"), i = a("./compressions"), j = a("./compressedObject"), k = a("./nodeBuffer"), l = a("./utf8"), m = a("./stringWriter"), n = a("./uint8ArrayWriter"), o = function (a) {
                            if (a._data instanceof j && (a._data = a._data.getContent(), a.options.binary = !0, a.options.base64 = !1, "uint8array" === d.getTypeOf(a._data))) {
                                var b = a._data;
                                a._data = new Uint8Array(b.length), 0 !== b.length && a._data.set(b, 0)
                            }
                            return a._data
                        }, p = function (a) {
                            var b = o(a), e = d.getTypeOf(b);
                            return "string" === e ? !a.options.binary && c.nodebuffer ? k(b, "utf-8") : a.asBinary() : b
                        }, q = function (a) {
                            var b = o(this);
                            return null === b || "undefined" == typeof b ? "" : (this.options.base64 && (b = h.decode(b)), b = a && this.options.binary ? D.utf8decode(b) : d.transformTo("string", b), a || this.options.binary || (b = d.transformTo("string", D.utf8encode(b))), b)
                        }, r = function (a, b, c) {
                            this.name = a, this.dir = c.dir, this.date = c.date, this.comment = c.comment, this.unixPermissions = c.unixPermissions, this.dosPermissions = c.dosPermissions, this._data = b, this.options = c, this._initialMetadata = {dir: c.dir, date: c.date}
                        };
                        r.prototype = {
                            asText: function () {
                                return q.call(this, !0)
                            }, asBinary: function () {
                                return q.call(this, !1)
                            }, asNodeBuffer: function () {
                                var a = p(this);
                                return d.transformTo("nodebuffer", a)
                            }, asUint8Array: function () {
                                var a = p(this);
                                return d.transformTo("uint8array", a)
                            }, asArrayBuffer: function () {
                                return this.asUint8Array().buffer
                            }
                        };
                        var s = function (a, b) {
                            var c, d = "";
                            for (c = 0; b > c; c++) d += String.fromCharCode(255 & a), a >>>= 8;
                            return d
                        }, t = function () {
                            var a, b, c = {};
                            for (a = 0; a < arguments.length; a++) for (b in arguments[a]) arguments[a].hasOwnProperty(b) && "undefined" == typeof c[b] && (c[b] = arguments[a][b]);
                            return c
                        }, u = function (a) {
                            return a = a || {}, a.base64 !== !0 || null !== a.binary && void 0 !== a.binary || (a.binary = !0), a = t(a, g), a.date = a.date || new Date, null !== a.compression && (a.compression = a.compression.toUpperCase()), a
                        }, v = function (a, b, c) {
                            var e, f = d.getTypeOf(b);
                            if (c = u(c), "string" == typeof c.unixPermissions && (c.unixPermissions = parseInt(c.unixPermissions, 8)), c.unixPermissions && 16384 & c.unixPermissions && (c.dir = !0), c.dosPermissions && 16 & c.dosPermissions && (c.dir = !0), c.dir && (a = x(a)), c.createFolders && (e = w(a)) && y.call(this, e, !0), c.dir || null === b || "undefined" == typeof b) c.base64 = !1, c.binary = !1, b = null, f = null; else if ("string" === f) c.binary && !c.base64 && c.optimizedBinaryString !== !0 && (b = d.string2binary(b)); else {
                                if (c.base64 = !1, c.binary = !0, !(f || b instanceof j)) throw new Error("The data of '" + a + "' is in an unsupported format !");
                                "arraybuffer" === f && (b = d.transformTo("uint8array", b))
                            }
                            var g = new r(a, b, c);
                            return this.files[a] = g, g
                        }, w = function (a) {
                            "/" == a.slice(-1) && (a = a.substring(0, a.length - 1));
                            var b = a.lastIndexOf("/");
                            return b > 0 ? a.substring(0, b) : ""
                        }, x = function (a) {
                            return "/" != a.slice(-1) && (a += "/"), a
                        }, y = function (a, b) {
                            return b = "undefined" != typeof b ? b : !1, a = x(a), this.files[a] || v.call(this, a, null, {dir: !0, createFolders: b}), this.files[a]
                        }, z = function (a, b, c) {
                            var f, g = new j;
                            return a._data instanceof j ? (g.uncompressedSize = a._data.uncompressedSize, g.crc32 = a._data.crc32, 0 === g.uncompressedSize || a.dir ? (b = i.STORE, g.compressedContent = "", g.crc32 = 0) : a._data.compressionMethod === b.magic ? g.compressedContent = a._data.getCompressedContent() : (f = a._data.getContent(), g.compressedContent = b.compress(d.transformTo(b.compressInputType, f), c))) : (f = p(a), (!f || 0 === f.length || a.dir) && (b = i.STORE, f = ""), g.uncompressedSize = f.length, g.crc32 = e(f), g.compressedContent = b.compress(d.transformTo(b.compressInputType, f), c)), g.compressedSize = g.compressedContent.length, g.compressionMethod = b.magic, g
                        }, A = function (a, b) {
                            var c = a;
                            return a || (c = b ? 16893 : 33204), (65535 & c) << 16
                        }, B = function (a) {
                            return 63 & (a || 0)
                        }, C = function (a, b, c, g, h) {
                            var i, j, k, m, n = (c.compressedContent, d.transformTo("string", l.utf8encode(b.name))), o = b.comment || "", p = d.transformTo("string", l.utf8encode(o)), q = n.length !== b.name.length, r = p.length !== o.length, t = b.options, u = "", v = "", w = "";
                            k = b._initialMetadata.dir !== b.dir ? b.dir : t.dir, m = b._initialMetadata.date !== b.date ? b.date : t.date;
                            var x = 0, y = 0;
                            k && (x |= 16), "UNIX" === h ? (y = 798, x |= A(b.unixPermissions, k)) : (y = 20, x |= B(b.dosPermissions, k)), i = m.getHours(), i <<= 6, i |= m.getMinutes(), i <<= 5, i |= m.getSeconds() / 2, j = m.getFullYear() - 1980, j <<= 4, j |= m.getMonth() + 1, j <<= 5, j |= m.getDate(), q && (v = s(1, 1) + s(e(n), 4) + n, u += "up" + s(v.length, 2) + v), r && (w = s(1, 1) + s(this.crc32(p), 4) + p, u += "uc" + s(w.length, 2) + w);
                            var z = "";
                            z += "\n\x00", z += q || r ? "\x00\b" : "\x00\x00", z += c.compressionMethod, z += s(i, 2), z += s(j, 2), z += s(c.crc32, 4), z += s(c.compressedSize, 4), z += s(c.uncompressedSize, 4), z += s(n.length, 2), z += s(u.length, 2);
                            var C = f.LOCAL_FILE_HEADER + z + n + u, D = f.CENTRAL_FILE_HEADER + s(y, 2) + z + s(p.length, 2) + "\x00\x00\x00\x00" + s(x, 4) + s(g, 4) + n + u + p;
                            return {fileRecord: C, dirRecord: D, compressedObject: c}
                        }, D = {
                            load: function () {
                                throw new Error("Load method is not defined. Is the file jszip-load.js included ?")
                            }, filter: function (a) {
                                var b, c, d, e, f = [];
                                for (b in this.files) this.files.hasOwnProperty(b) && (d = this.files[b], e = new r(d.name, d._data, t(d.options)), c = b.slice(this.root.length, b.length), b.slice(0, this.root.length) === this.root && a(c, e) && f.push(e));
                                return f
                            }, file: function (a, b, c) {
                                if (1 === arguments.length) {
                                    if (d.isRegExp(a)) {
                                        var e = a;
                                        return this.filter(function (a, b) {
                                            return !b.dir && e.test(a)
                                        })
                                    }
                                    return this.filter(function (b, c) {
                                        return !c.dir && b === a
                                    })[0] || null
                                }
                                return a = this.root + a, v.call(this, a, b, c), this
                            }, folder: function (a) {
                                if (!a) return this;
                                if (d.isRegExp(a)) return this.filter(function (b, c) {
                                    return c.dir && a.test(b)
                                });
                                var b = this.root + a, c = y.call(this, b), e = this.clone();
                                return e.root = c.name, e
                            }, remove: function (a) {
                                a = this.root + a;
                                var b = this.files[a];
                                if (b || ("/" != a.slice(-1) && (a += "/"), b = this.files[a]), b && !b.dir) delete this.files[a]; else for (var c = this.filter(function (b, c) {
                                    return c.name.slice(0, a.length) === a
                                }), d = 0; d < c.length; d++) delete this.files[c[d].name];
                                return this
                            }, generate: function (a) {
                                a = t(a || {}, {base64: !0, compression: "STORE", compressionOptions: null, type: "base64", platform: "DOS", comment: null, mimeType: "application/zip"}), d.checkSupport(a.type), ("darwin" === a.platform || "freebsd" === a.platform || "linux" === a.platform || "sunos" === a.platform) && (a.platform = "UNIX"), "win32" === a.platform && (a.platform = "DOS");
                                var b, c, e = [], g = 0, j = 0, k = d.transformTo("string", this.utf8encode(a.comment || this.comment || ""));
                                for (var l in this.files) if (this.files.hasOwnProperty(l)) {
                                    var o = this.files[l], p = o.options.compression || a.compression.toUpperCase(), q = i[p];
                                    if (!q) throw new Error(p + " is not a valid compression method !");
                                    var r = o.options.compressionOptions || a.compressionOptions || {}, u = z.call(this, o, q, r), v = C.call(this, l, o, u, g, a.platform);
                                    g += v.fileRecord.length + u.compressedSize, j += v.dirRecord.length, e.push(v)
                                }
                                var w = "";
                                w = f.CENTRAL_DIRECTORY_END + "\x00\x00\x00\x00" + s(e.length, 2) + s(e.length, 2) + s(j, 4) + s(g, 4) + s(k.length, 2) + k;
                                var x = a.type.toLowerCase();
                                for (b = "uint8array" === x || "arraybuffer" === x || "blob" === x || "nodebuffer" === x ? new n(g + j + w.length) : new m(g + j + w.length), c = 0; c < e.length; c++) b.append(e[c].fileRecord), b.append(e[c].compressedObject.compressedContent);
                                for (c = 0; c < e.length; c++) b.append(e[c].dirRecord);
                                b.append(w);
                                var y = b.finalize();
                                switch (a.type.toLowerCase()) {
                                    case"uint8array":
                                    case"arraybuffer":
                                    case"nodebuffer":
                                        return d.transformTo(a.type.toLowerCase(), y);
                                    case"blob":
                                        return d.arrayBuffer2Blob(d.transformTo("arraybuffer", y), a.mimeType);
                                    case"base64":
                                        return a.base64 ? h.encode(y) : y;
                                    default:
                                        return y
                                }
                            }, crc32: function (a, b) {
                                return e(a, b)
                            }, utf8encode: function (a) {
                                return d.transformTo("string", l.utf8encode(a))
                            }, utf8decode: function (a) {
                                return l.utf8decode(a)
                            }
                        };
                        b.exports = D
                    }, {"./base64": 1, "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./defaults": 6, "./nodeBuffer": 11, "./signature": 14, "./stringWriter": 16, "./support": 17, "./uint8ArrayWriter": 19, "./utf8": 20, "./utils": 21}], 14: [function (a, b, c) {
                        "use strict";
                        c.LOCAL_FILE_HEADER = "PK", c.CENTRAL_FILE_HEADER = "PK", c.CENTRAL_DIRECTORY_END = "PK", c.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK", c.ZIP64_CENTRAL_DIRECTORY_END = "PK", c.DATA_DESCRIPTOR = "PK\b"
                    }, {}], 15: [function (a, b) {
                        "use strict";

                        function c(a, b) {
                            this.data = a, b || (this.data = e.string2binary(this.data)), this.length = this.data.length, this.index = 0
                        }

                        var d = a("./dataReader"), e = a("./utils");
                        c.prototype = new d, c.prototype.byteAt = function (a) {
                            return this.data.charCodeAt(a)
                        }, c.prototype.lastIndexOfSignature = function (a) {
                            return this.data.lastIndexOf(a)
                        }, c.prototype.readData = function (a) {
                            this.checkOffset(a);
                            var b = this.data.slice(this.index, this.index + a);
                            return this.index += a, b
                        }, b.exports = c
                    }, {"./dataReader": 5, "./utils": 21}], 16: [function (a, b) {
                        "use strict";
                        var c = a("./utils"), d = function () {
                            this.data = []
                        };
                        d.prototype = {
                            append: function (a) {
                                a = c.transformTo("string", a), this.data.push(a)
                            }, finalize: function () {
                                return this.data.join("")
                            }
                        }, b.exports = d
                    }, {"./utils": 21}], 17: [function (a, b, c) {
                        (function (a) {
                            "use strict";
                            if (c.base64 = !0, c.array = !0, c.string = !0, c.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, c.nodebuffer = "undefined" != typeof a, c.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) c.blob = !1; else {
                                var b = new ArrayBuffer(0);
                                try {
                                    c.blob = 0 === new Blob([b], {type: "application/zip"}).size
                                } catch (d) {
                                    try {
                                        var e = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder, f = new e;
                                        f.append(b), c.blob = 0 === f.getBlob("application/zip").size
                                    } catch (d) {
                                        c.blob = !1
                                    }
                                }
                            }
                        }).call(this, "undefined" != typeof Buffer ? Buffer : void 0)
                    }, {}], 18: [function (a, b) {
                        "use strict";

                        function c(a) {
                            a && (this.data = a, this.length = this.data.length, this.index = 0)
                        }

                        var d = a("./dataReader");
                        c.prototype = new d, c.prototype.byteAt = function (a) {
                            return this.data[a]
                        }, c.prototype.lastIndexOfSignature = function (a) {
                            for (var b = a.charCodeAt(0), c = a.charCodeAt(1), d = a.charCodeAt(2), e = a.charCodeAt(3), f = this.length - 4; f >= 0; --f) if (this.data[f] === b && this.data[f + 1] === c && this.data[f + 2] === d && this.data[f + 3] === e) return f;
                            return -1
                        }, c.prototype.readData = function (a) {
                            if (this.checkOffset(a), 0 === a) return new Uint8Array(0);
                            var b = this.data.subarray(this.index, this.index + a);
                            return this.index += a, b
                        }, b.exports = c
                    }, {"./dataReader": 5}], 19: [function (a, b) {
                        "use strict";
                        var c = a("./utils"), d = function (a) {
                            this.data = new Uint8Array(a), this.index = 0
                        };
                        d.prototype = {
                            append: function (a) {
                                0 !== a.length && (a = c.transformTo("uint8array", a), this.data.set(a, this.index), this.index += a.length)
                            }, finalize: function () {
                                return this.data
                            }
                        }, b.exports = d
                    }, {"./utils": 21}], 20: [function (a, b, c) {
                        "use strict";
                        for (var d = a("./utils"), e = a("./support"), f = a("./nodeBuffer"), g = new Array(256), h = 0; 256 > h; h++) g[h] = h >= 252 ? 6 : h >= 248 ? 5 : h >= 240 ? 4 : h >= 224 ? 3 : h >= 192 ? 2 : 1;
                        g[254] = g[254] = 1;
                        var i = function (a) {
                            var b, c, d, f, g, h = a.length, i = 0;
                            for (f = 0; h > f; f++) c = a.charCodeAt(f), 55296 === (64512 & c) && h > f + 1 && (d = a.charCodeAt(f + 1), 56320 === (64512 & d) && (c = 65536 + (c - 55296 << 10) + (d - 56320), f++)), i += 128 > c ? 1 : 2048 > c ? 2 : 65536 > c ? 3 : 4;
                            for (b = e.uint8array ? new Uint8Array(i) : new Array(i), g = 0, f = 0; i > g; f++) c = a.charCodeAt(f), 55296 === (64512 & c) && h > f + 1 && (d = a.charCodeAt(f + 1), 56320 === (64512 & d) && (c = 65536 + (c - 55296 << 10) + (d - 56320), f++)), 128 > c ? b[g++] = c : 2048 > c ? (b[g++] = 192 | c >>> 6, b[g++] = 128 | 63 & c) : 65536 > c ? (b[g++] = 224 | c >>> 12, b[g++] = 128 | c >>> 6 & 63, b[g++] = 128 | 63 & c) : (b[g++] = 240 | c >>> 18, b[g++] = 128 | c >>> 12 & 63, b[g++] = 128 | c >>> 6 & 63, b[g++] = 128 | 63 & c);
                            return b
                        }, j = function (a, b) {
                            var c;
                            for (b = b || a.length, b > a.length && (b = a.length), c = b - 1; c >= 0 && 128 === (192 & a[c]);) c--;
                            return 0 > c ? b : 0 === c ? b : c + g[a[c]] > b ? c : b
                        }, k = function (a) {
                            var b, c, e, f, h = a.length, i = new Array(2 * h);
                            for (c = 0, b = 0; h > b;) if (e = a[b++], 128 > e) i[c++] = e; else if (f = g[e], f > 4) i[c++] = 65533, b += f - 1; else {
                                for (e &= 2 === f ? 31 : 3 === f ? 15 : 7; f > 1 && h > b;) e = e << 6 | 63 & a[b++], f--;
                                f > 1 ? i[c++] = 65533 : 65536 > e ? i[c++] = e : (e -= 65536, i[c++] = 55296 | e >> 10 & 1023, i[c++] = 56320 | 1023 & e)
                            }
                            return i.length !== c && (i.subarray ? i = i.subarray(0, c) : i.length = c), d.applyFromCharCode(i)
                        };
                        c.utf8encode = function (a) {
                            return e.nodebuffer ? f(a, "utf-8") : i(a)
                        }, c.utf8decode = function (a) {
                            if (e.nodebuffer) return d.transformTo("nodebuffer", a).toString("utf-8");
                            a = d.transformTo(e.uint8array ? "uint8array" : "array", a);
                            for (var b = [], c = 0, f = a.length, g = 65536; f > c;) {
                                var h = j(a, Math.min(c + g, f));
                                b.push(e.uint8array ? k(a.subarray(c, h)) : k(a.slice(c, h))), c = h
                            }
                            return b.join("")
                        }
                    }, {"./nodeBuffer": 11, "./support": 17, "./utils": 21}], 21: [function (a, b, c) {
                        "use strict";

                        function d(a) {
                            return a
                        }

                        function e(a, b) {
                            for (var c = 0; c < a.length; ++c) b[c] = 255 & a.charCodeAt(c);
                            return b
                        }

                        function f(a) {
                            var b = 65536, d = [], e = a.length, f = c.getTypeOf(a), g = 0, h = !0;
                            try {
                                switch (f) {
                                    case"uint8array":
                                        String.fromCharCode.apply(null, new Uint8Array(0));
                                        break;
                                    case"nodebuffer":
                                        String.fromCharCode.apply(null, j(0))
                                }
                            } catch (i) {
                                h = !1
                            }
                            if (!h) {
                                for (var k = "", l = 0; l < a.length; l++) k += String.fromCharCode(a[l]);
                                return k
                            }
                            for (; e > g && b > 1;) try {
                                d.push("array" === f || "nodebuffer" === f ? String.fromCharCode.apply(null, a.slice(g, Math.min(g + b, e))) : String.fromCharCode.apply(null, a.subarray(g, Math.min(g + b, e)))), g += b
                            } catch (i) {
                                b = Math.floor(b / 2)
                            }
                            return d.join("")
                        }

                        function g(a, b) {
                            for (var c = 0; c < a.length; c++) b[c] = a[c];
                            return b
                        }

                        var h = a("./support"), i = a("./compressions"), j = a("./nodeBuffer");
                        c.string2binary = function (a) {
                            for (var b = "", c = 0; c < a.length; c++) b += String.fromCharCode(255 & a.charCodeAt(c));
                            return b
                        }, c.arrayBuffer2Blob = function (a, b) {
                            c.checkSupport("blob"), b = b || "application/zip";
                            try {
                                return new Blob([a], {type: b})
                            } catch (d) {
                                try {
                                    var e = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder, f = new e;
                                    return f.append(a), f.getBlob(b)
                                } catch (d) {
                                    throw new Error("Bug : can't construct the Blob.")
                                }
                            }
                        }, c.applyFromCharCode = f;
                        var k = {};
                        k.string = {
                            string: d, array: function (a) {
                                return e(a, new Array(a.length))
                            }, arraybuffer: function (a) {
                                return k.string.uint8array(a).buffer
                            }, uint8array: function (a) {
                                return e(a, new Uint8Array(a.length))
                            }, nodebuffer: function (a) {
                                return e(a, j(a.length))
                            }
                        }, k.array = {
                            string: f, array: d, arraybuffer: function (a) {
                                return new Uint8Array(a).buffer
                            }, uint8array: function (a) {
                                return new Uint8Array(a)
                            }, nodebuffer: function (a) {
                                return j(a)
                            }
                        }, k.arraybuffer = {
                            string: function (a) {
                                return f(new Uint8Array(a))
                            }, array: function (a) {
                                return g(new Uint8Array(a), new Array(a.byteLength))
                            }, arraybuffer: d, uint8array: function (a) {
                                return new Uint8Array(a)
                            }, nodebuffer: function (a) {
                                return j(new Uint8Array(a))
                            }
                        }, k.uint8array = {
                            string: f, array: function (a) {
                                return g(a, new Array(a.length))
                            }, arraybuffer: function (a) {
                                return a.buffer
                            }, uint8array: d, nodebuffer: function (a) {
                                return j(a)
                            }
                        }, k.nodebuffer = {
                            string: f, array: function (a) {
                                return g(a, new Array(a.length))
                            }, arraybuffer: function (a) {
                                return k.nodebuffer.uint8array(a).buffer
                            }, uint8array: function (a) {
                                return g(a, new Uint8Array(a.length))
                            }, nodebuffer: d
                        }, c.transformTo = function (a, b) {
                            if (b || (b = ""), !a) return b;
                            c.checkSupport(a);
                            var d = c.getTypeOf(b), e = k[d][a](b);
                            return e
                        }, c.getTypeOf = function (a) {
                            return "string" == typeof a ? "string" : "[object Array]" === Object.prototype.toString.call(a) ? "array" : h.nodebuffer && j.test(a) ? "nodebuffer" : h.uint8array && a instanceof Uint8Array ? "uint8array" : h.arraybuffer && a instanceof ArrayBuffer ? "arraybuffer" : void 0
                        }, c.checkSupport = function (a) {
                            var b = h[a.toLowerCase()];
                            if (!b) throw new Error(a + " is not supported by this browser")
                        }, c.MAX_VALUE_16BITS = 65535, c.MAX_VALUE_32BITS = -1, c.pretty = function (a) {
                            var b, c, d = "";
                            for (c = 0; c < (a || "").length; c++) b = a.charCodeAt(c), d += "\\x" + (16 > b ? "0" : "") + b.toString(16).toUpperCase();
                            return d
                        }, c.findCompression = function (a) {
                            for (var b in i) if (i.hasOwnProperty(b) && i[b].magic === a) return i[b];
                            return null
                        }, c.isRegExp = function (a) {
                            return "[object RegExp]" === Object.prototype.toString.call(a)
                        }
                    }, {"./compressions": 3, "./nodeBuffer": 11, "./support": 17}], 22: [function (a, b) {
                        "use strict";

                        function c(a, b) {
                            this.files = [], this.loadOptions = b, a && this.load(a)
                        }

                        var d = a("./stringReader"), e = a("./nodeBufferReader"), f = a("./uint8ArrayReader"), g = a("./utils"), h = a("./signature"), i = a("./zipEntry"), j = a("./support"), k = a("./object");
                        c.prototype = {
                            checkSignature: function (a) {
                                var b = this.reader.readString(4);
                                if (b !== a) throw new Error("Corrupted zip or bug : unexpected signature (" + g.pretty(b) + ", expected " + g.pretty(a) + ")")
                            }, readBlockEndOfCentral: function () {
                                this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2), this.zipComment = this.reader.readString(this.zipCommentLength), this.zipComment = k.utf8decode(this.zipComment)
                            }, readBlockZip64EndOfCentral: function () {
                                this.zip64EndOfCentralSize = this.reader.readInt(8), this.versionMadeBy = this.reader.readString(2), this.versionNeeded = this.reader.readInt(2), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
                                for (var a, b, c, d = this.zip64EndOfCentralSize - 44, e = 0; d > e;) a = this.reader.readInt(2), b = this.reader.readInt(4), c = this.reader.readString(b), this.zip64ExtensibleData[a] = {id: a, length: b, value: c}
                            }, readBlockZip64EndOfCentralLocator: function () {
                                if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), this.disksCount > 1) throw new Error("Multi-volumes zip are not supported")
                            }, readLocalFiles: function () {
                                var a, b;
                                for (a = 0; a < this.files.length; a++) b = this.files[a], this.reader.setIndex(b.localHeaderOffset), this.checkSignature(h.LOCAL_FILE_HEADER), b.readLocalPart(this.reader), b.handleUTF8(), b.processAttributes()
                            }, readCentralDir: function () {
                                var a;
                                for (this.reader.setIndex(this.centralDirOffset); this.reader.readString(4) === h.CENTRAL_FILE_HEADER;) a = new i({zip64: this.zip64}, this.loadOptions), a.readCentralPart(this.reader), this.files.push(a)
                            }, readEndOfCentral: function () {
                                var a = this.reader.lastIndexOfSignature(h.CENTRAL_DIRECTORY_END);
                                if (-1 === a) {
                                    var b = !0;
                                    try {
                                        this.reader.setIndex(0), this.checkSignature(h.LOCAL_FILE_HEADER), b = !1
                                    } catch (c) {
                                    }
                                    throw new Error(b ? "Can't find end of central directory : is this a zip file ? If it is, see http://stuk.github.io/jszip/documentation/howto/read_zip.html" : "Corrupted zip : can't find end of central directory")
                                }
                                if (this.reader.setIndex(a), this.checkSignature(h.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === g.MAX_VALUE_16BITS || this.diskWithCentralDirStart === g.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === g.MAX_VALUE_16BITS || this.centralDirRecords === g.MAX_VALUE_16BITS || this.centralDirSize === g.MAX_VALUE_32BITS || this.centralDirOffset === g.MAX_VALUE_32BITS) {
                                    if (this.zip64 = !0, a = this.reader.lastIndexOfSignature(h.ZIP64_CENTRAL_DIRECTORY_LOCATOR), -1 === a) throw new Error("Corrupted zip : can't find the ZIP64 end of central directory locator");
                                    this.reader.setIndex(a), this.checkSignature(h.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(h.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral()
                                }
                            }, prepareReader: function (a) {
                                var b = g.getTypeOf(a);
                                this.reader = "string" !== b || j.uint8array ? "nodebuffer" === b ? new e(a) : new f(g.transformTo("uint8array", a)) : new d(a, this.loadOptions.optimizedBinaryString)
                            }, load: function (a) {
                                this.prepareReader(a), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles()
                            }
                        }, b.exports = c
                    }, {"./nodeBufferReader": 12, "./object": 13, "./signature": 14, "./stringReader": 15, "./support": 17, "./uint8ArrayReader": 18, "./utils": 21, "./zipEntry": 23}], 23: [function (a, b) {
                        "use strict";

                        function c(a, b) {
                            this.options = a, this.loadOptions = b
                        }

                        var d = a("./stringReader"), e = a("./utils"), f = a("./compressedObject"), g = a("./object"), h = 0, i = 3;
                        c.prototype = {
                            isEncrypted: function () {
                                return 1 === (1 & this.bitFlag)
                            }, useUTF8: function () {
                                return 2048 === (2048 & this.bitFlag)
                            }, prepareCompressedContent: function (a, b, c) {
                                return function () {
                                    var d = a.index;
                                    a.setIndex(b);
                                    var e = a.readData(c);
                                    return a.setIndex(d), e
                                }
                            }, prepareContent: function (a, b, c, d, f) {
                                return function () {
                                    var a = e.transformTo(d.uncompressInputType, this.getCompressedContent()), b = d.uncompress(a);
                                    if (b.length !== f) throw new Error("Bug : uncompressed data size mismatch");
                                    return b
                                }
                            }, readLocalPart: function (a) {
                                var b, c;
                                if (a.skip(22), this.fileNameLength = a.readInt(2), c = a.readInt(2), this.fileName = a.readString(this.fileNameLength), a.skip(c), -1 == this.compressedSize || -1 == this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory (compressedSize == -1 || uncompressedSize == -1)");
                                if (b = e.findCompression(this.compressionMethod), null === b) throw new Error("Corrupted zip : compression " + e.pretty(this.compressionMethod) + " unknown (inner file : " + this.fileName + ")");
                                if (this.decompressed = new f, this.decompressed.compressedSize = this.compressedSize, this.decompressed.uncompressedSize = this.uncompressedSize, this.decompressed.crc32 = this.crc32, this.decompressed.compressionMethod = this.compressionMethod, this.decompressed.getCompressedContent = this.prepareCompressedContent(a, a.index, this.compressedSize, b), this.decompressed.getContent = this.prepareContent(a, a.index, this.compressedSize, b, this.uncompressedSize), this.loadOptions.checkCRC32 && (this.decompressed = e.transformTo("string", this.decompressed.getContent()), g.crc32(this.decompressed) !== this.crc32)) throw new Error("Corrupted zip : CRC32 mismatch")
                            }, readCentralPart: function (a) {
                                if (this.versionMadeBy = a.readInt(2), this.versionNeeded = a.readInt(2), this.bitFlag = a.readInt(2), this.compressionMethod = a.readString(2), this.date = a.readDate(), this.crc32 = a.readInt(4), this.compressedSize = a.readInt(4), this.uncompressedSize = a.readInt(4), this.fileNameLength = a.readInt(2), this.extraFieldsLength = a.readInt(2), this.fileCommentLength = a.readInt(2), this.diskNumberStart = a.readInt(2), this.internalFileAttributes = a.readInt(2), this.externalFileAttributes = a.readInt(4), this.localHeaderOffset = a.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
                                this.fileName = a.readString(this.fileNameLength), this.readExtraFields(a), this.parseZIP64ExtraField(a), this.fileComment = a.readString(this.fileCommentLength)
                            }, processAttributes: function () {
                                this.unixPermissions = null, this.dosPermissions = null;
                                var a = this.versionMadeBy >> 8;
                                this.dir = 16 & this.externalFileAttributes ? !0 : !1, a === h && (this.dosPermissions = 63 & this.externalFileAttributes), a === i && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileName.slice(-1) || (this.dir = !0)
                            }, parseZIP64ExtraField: function () {
                                if (this.extraFields[1]) {
                                    var a = new d(this.extraFields[1].value);
                                    this.uncompressedSize === e.MAX_VALUE_32BITS && (this.uncompressedSize = a.readInt(8)), this.compressedSize === e.MAX_VALUE_32BITS && (this.compressedSize = a.readInt(8)), this.localHeaderOffset === e.MAX_VALUE_32BITS && (this.localHeaderOffset = a.readInt(8)), this.diskNumberStart === e.MAX_VALUE_32BITS && (this.diskNumberStart = a.readInt(4))
                                }
                            }, readExtraFields: function (a) {
                                var b, c, d, e = a.index;
                                for (this.extraFields = this.extraFields || {}; a.index < e + this.extraFieldsLength;) b = a.readInt(2), c = a.readInt(2), d = a.readString(c), this.extraFields[b] = {id: b, length: c, value: d}
                            }, handleUTF8: function () {
                                if (this.useUTF8()) this.fileName = g.utf8decode(this.fileName), this.fileComment = g.utf8decode(this.fileComment); else {
                                    var a = this.findExtraFieldUnicodePath();
                                    null !== a && (this.fileName = a);
                                    var b = this.findExtraFieldUnicodeComment();
                                    null !== b && (this.fileComment = b)
                                }
                            }, findExtraFieldUnicodePath: function () {
                                var a = this.extraFields[28789];
                                if (a) {
                                    var b = new d(a.value);
                                    return 1 !== b.readInt(1) ? null : g.crc32(this.fileName) !== b.readInt(4) ? null : g.utf8decode(b.readString(a.length - 5))
                                }
                                return null
                            }, findExtraFieldUnicodeComment: function () {
                                var a = this.extraFields[25461];
                                if (a) {
                                    var b = new d(a.value);
                                    return 1 !== b.readInt(1) ? null : g.crc32(this.fileComment) !== b.readInt(4) ? null : g.utf8decode(b.readString(a.length - 5))
                                }
                                return null
                            }
                        }, b.exports = c
                    }, {"./compressedObject": 2, "./object": 13, "./stringReader": 15, "./utils": 21}], 24: [function (a, b) {
                        "use strict";
                        var c = a("./lib/utils/common").assign, d = a("./lib/deflate"), e = a("./lib/inflate"), f = a("./lib/zlib/constants"), g = {};
                        c(g, d, e, f), b.exports = g
                    }, {"./lib/deflate": 25, "./lib/inflate": 26, "./lib/utils/common": 27, "./lib/zlib/constants": 30}], 25: [function (a, b, c) {
                        "use strict";

                        function d(a, b) {
                            var c = new s(b);
                            if (c.push(a, !0), c.err) throw c.msg;
                            return c.result
                        }

                        function e(a, b) {
                            return b = b || {}, b.raw = !0, d(a, b)
                        }

                        function f(a, b) {
                            return b = b || {}, b.gzip = !0, d(a, b)
                        }

                        var g = a("./zlib/deflate.js"), h = a("./utils/common"), i = a("./utils/strings"), j = a("./zlib/messages"), k = a("./zlib/zstream"), l = 0, m = 4, n = 0, o = 1, p = -1, q = 0, r = 8, s = function (a) {
                            this.options = h.assign({level: p, method: r, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: q, to: ""}, a || {});
                            var b = this.options;
                            b.raw && b.windowBits > 0 ? b.windowBits = -b.windowBits : b.gzip && b.windowBits > 0 && b.windowBits < 16 && (b.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new k, this.strm.avail_out = 0;
                            var c = g.deflateInit2(this.strm, b.level, b.method, b.windowBits, b.memLevel, b.strategy);
                            if (c !== n) throw new Error(j[c]);
                            b.header && g.deflateSetHeader(this.strm, b.header)
                        };
                        s.prototype.push = function (a, b) {
                            var c, d, e = this.strm, f = this.options.chunkSize;
                            if (this.ended) return !1;
                            d = b === ~~b ? b : b === !0 ? m : l, e.input = "string" == typeof a ? i.string2buf(a) : a, e.next_in = 0, e.avail_in = e.input.length;
                            do {
                                if (0 === e.avail_out && (e.output = new h.Buf8(f), e.next_out = 0, e.avail_out = f), c = g.deflate(e, d), c !== o && c !== n) return this.onEnd(c), this.ended = !0, !1;
                                (0 === e.avail_out || 0 === e.avail_in && d === m) && this.onData("string" === this.options.to ? i.buf2binstring(h.shrinkBuf(e.output, e.next_out)) : h.shrinkBuf(e.output, e.next_out))
                            } while ((e.avail_in > 0 || 0 === e.avail_out) && c !== o);
                            return d === m ? (c = g.deflateEnd(this.strm), this.onEnd(c), this.ended = !0, c === n) : !0
                        }, s.prototype.onData = function (a) {
                            this.chunks.push(a)
                        }, s.prototype.onEnd = function (a) {
                            a === n && (this.result = "string" === this.options.to ? this.chunks.join("") : h.flattenChunks(this.chunks)), this.chunks = [], this.err = a, this.msg = this.strm.msg
                        }, c.Deflate = s, c.deflate = d, c.deflateRaw = e, c.gzip = f
                    }, {"./utils/common": 27, "./utils/strings": 28, "./zlib/deflate.js": 32, "./zlib/messages": 37, "./zlib/zstream": 39}], 26: [function (a, b, c) {
                        "use strict";

                        function d(a, b) {
                            var c = new m(b);
                            if (c.push(a, !0), c.err) throw c.msg;
                            return c.result
                        }

                        function e(a, b) {
                            return b = b || {}, b.raw = !0, d(a, b)
                        }

                        var f = a("./zlib/inflate.js"), g = a("./utils/common"), h = a("./utils/strings"), i = a("./zlib/constants"), j = a("./zlib/messages"), k = a("./zlib/zstream"), l = a("./zlib/gzheader"), m = function (a) {
                            this.options = g.assign({chunkSize: 16384, windowBits: 0, to: ""}, a || {});
                            var b = this.options;
                            b.raw && b.windowBits >= 0 && b.windowBits < 16 && (b.windowBits = -b.windowBits, 0 === b.windowBits && (b.windowBits = -15)), !(b.windowBits >= 0 && b.windowBits < 16) || a && a.windowBits || (b.windowBits += 32), b.windowBits > 15 && b.windowBits < 48 && 0 === (15 & b.windowBits) && (b.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new k, this.strm.avail_out = 0;
                            var c = f.inflateInit2(this.strm, b.windowBits);
                            if (c !== i.Z_OK) throw new Error(j[c]);
                            this.header = new l, f.inflateGetHeader(this.strm, this.header)
                        };
                        m.prototype.push = function (a, b) {
                            var c, d, e, j, k, l = this.strm, m = this.options.chunkSize;
                            if (this.ended) return !1;
                            d = b === ~~b ? b : b === !0 ? i.Z_FINISH : i.Z_NO_FLUSH, l.input = "string" == typeof a ? h.binstring2buf(a) : a, l.next_in = 0, l.avail_in = l.input.length;
                            do {
                                if (0 === l.avail_out && (l.output = new g.Buf8(m), l.next_out = 0, l.avail_out = m), c = f.inflate(l, i.Z_NO_FLUSH), c !== i.Z_STREAM_END && c !== i.Z_OK) return this.onEnd(c), this.ended = !0, !1;
                                l.next_out && (0 === l.avail_out || c === i.Z_STREAM_END || 0 === l.avail_in && d === i.Z_FINISH) && ("string" === this.options.to ? (e = h.utf8border(l.output, l.next_out), j = l.next_out - e, k = h.buf2string(l.output, e), l.next_out = j, l.avail_out = m - j, j && g.arraySet(l.output, l.output, e, j, 0), this.onData(k)) : this.onData(g.shrinkBuf(l.output, l.next_out)))
                            } while (l.avail_in > 0 && c !== i.Z_STREAM_END);
                            return c === i.Z_STREAM_END && (d = i.Z_FINISH), d === i.Z_FINISH ? (c = f.inflateEnd(this.strm), this.onEnd(c), this.ended = !0, c === i.Z_OK) : !0
                        }, m.prototype.onData = function (a) {
                            this.chunks.push(a)
                        }, m.prototype.onEnd = function (a) {
                            a === i.Z_OK && (this.result = "string" === this.options.to ? this.chunks.join("") : g.flattenChunks(this.chunks)), this.chunks = [], this.err = a, this.msg = this.strm.msg
                        }, c.Inflate = m, c.inflate = d, c.inflateRaw = e, c.ungzip = d
                    }, {"./utils/common": 27, "./utils/strings": 28, "./zlib/constants": 30, "./zlib/gzheader": 33, "./zlib/inflate.js": 35, "./zlib/messages": 37, "./zlib/zstream": 39}], 27: [function (a, b, c) {
                        "use strict";
                        var d = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
                        c.assign = function (a) {
                            for (var b = Array.prototype.slice.call(arguments, 1); b.length;) {
                                var c = b.shift();
                                if (c) {
                                    if ("object" != typeof c) throw new TypeError(c + "must be non-object");
                                    for (var d in c) c.hasOwnProperty(d) && (a[d] = c[d])
                                }
                            }
                            return a
                        }, c.shrinkBuf = function (a, b) {
                            return a.length === b ? a : a.subarray ? a.subarray(0, b) : (a.length = b, a)
                        };
                        var e = {
                            arraySet: function (a, b, c, d, e) {
                                if (b.subarray && a.subarray) return void a.set(b.subarray(c, c + d), e);
                                for (var f = 0; d > f; f++) a[e + f] = b[c + f]
                            }, flattenChunks: function (a) {
                                var b, c, d, e, f, g;
                                for (d = 0, b = 0, c = a.length; c > b; b++) d += a[b].length;
                                for (g = new Uint8Array(d), e = 0, b = 0, c = a.length; c > b; b++) f = a[b], g.set(f, e), e += f.length;
                                return g
                            }
                        }, f = {
                            arraySet: function (a, b, c, d, e) {
                                for (var f = 0; d > f; f++) a[e + f] = b[c + f]
                            }, flattenChunks: function (a) {
                                return [].concat.apply([], a)
                            }
                        };
                        c.setTyped = function (a) {
                            a ? (c.Buf8 = Uint8Array, c.Buf16 = Uint16Array, c.Buf32 = Int32Array, c.assign(c, e)) : (c.Buf8 = Array, c.Buf16 = Array, c.Buf32 = Array, c.assign(c, f))
                        }, c.setTyped(d)
                    }, {}], 28: [function (a, b, c) {
                        "use strict";

                        function d(a, b) {
                            if (65537 > b && (a.subarray && g || !a.subarray && f)) return String.fromCharCode.apply(null, e.shrinkBuf(a, b));
                            for (var c = "", d = 0; b > d; d++) c += String.fromCharCode(a[d]);
                            return c
                        }

                        var e = a("./common"), f = !0, g = !0;
                        try {
                            String.fromCharCode.apply(null, [0])
                        } catch (h) {
                            f = !1
                        }
                        try {
                            String.fromCharCode.apply(null, new Uint8Array(1))
                        } catch (h) {
                            g = !1
                        }
                        for (var i = new e.Buf8(256), j = 0; 256 > j; j++) i[j] = j >= 252 ? 6 : j >= 248 ? 5 : j >= 240 ? 4 : j >= 224 ? 3 : j >= 192 ? 2 : 1;
                        i[254] = i[254] = 1, c.string2buf = function (a) {
                            var b, c, d, f, g, h = a.length, i = 0;
                            for (f = 0; h > f; f++) c = a.charCodeAt(f), 55296 === (64512 & c) && h > f + 1 && (d = a.charCodeAt(f + 1), 56320 === (64512 & d) && (c = 65536 + (c - 55296 << 10) + (d - 56320), f++)), i += 128 > c ? 1 : 2048 > c ? 2 : 65536 > c ? 3 : 4;
                            for (b = new e.Buf8(i), g = 0, f = 0; i > g; f++) c = a.charCodeAt(f), 55296 === (64512 & c) && h > f + 1 && (d = a.charCodeAt(f + 1), 56320 === (64512 & d) && (c = 65536 + (c - 55296 << 10) + (d - 56320), f++)), 128 > c ? b[g++] = c : 2048 > c ? (b[g++] = 192 | c >>> 6, b[g++] = 128 | 63 & c) : 65536 > c ? (b[g++] = 224 | c >>> 12, b[g++] = 128 | c >>> 6 & 63, b[g++] = 128 | 63 & c) : (b[g++] = 240 | c >>> 18, b[g++] = 128 | c >>> 12 & 63, b[g++] = 128 | c >>> 6 & 63, b[g++] = 128 | 63 & c);
                            return b
                        }, c.buf2binstring = function (a) {
                            return d(a, a.length)
                        }, c.binstring2buf = function (a) {
                            for (var b = new e.Buf8(a.length), c = 0, d = b.length; d > c; c++) b[c] = a.charCodeAt(c);
                            return b
                        }, c.buf2string = function (a, b) {
                            var c, e, f, g, h = b || a.length, j = new Array(2 * h);
                            for (e = 0, c = 0; h > c;) if (f = a[c++], 128 > f) j[e++] = f; else if (g = i[f], g > 4) j[e++] = 65533, c += g - 1; else {
                                for (f &= 2 === g ? 31 : 3 === g ? 15 : 7; g > 1 && h > c;) f = f << 6 | 63 & a[c++], g--;
                                g > 1 ? j[e++] = 65533 : 65536 > f ? j[e++] = f : (f -= 65536, j[e++] = 55296 | f >> 10 & 1023, j[e++] = 56320 | 1023 & f)
                            }
                            return d(j, e)
                        }, c.utf8border = function (a, b) {
                            var c;
                            for (b = b || a.length, b > a.length && (b = a.length), c = b - 1; c >= 0 && 128 === (192 & a[c]);) c--;
                            return 0 > c ? b : 0 === c ? b : c + i[a[c]] > b ? c : b
                        }
                    }, {"./common": 27}], 29: [function (a, b) {
                        "use strict";

                        function c(a, b, c, d) {
                            for (var e = 65535 & a | 0, f = a >>> 16 & 65535 | 0, g = 0; 0 !== c;) {
                                g = c > 2e3 ? 2e3 : c, c -= g;
                                do e = e + b[d++] | 0, f = f + e | 0; while (--g);
                                e %= 65521, f %= 65521
                            }
                            return e | f << 16 | 0
                        }

                        b.exports = c
                    }, {}], 30: [function (a, b) {
                        b.exports = {Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8}
                    }, {}], 31: [function (a, b) {
                        "use strict";

                        function c() {
                            for (var a, b = [], c = 0; 256 > c; c++) {
                                a = c;
                                for (var d = 0; 8 > d; d++) a = 1 & a ? 3988292384 ^ a >>> 1 : a >>> 1;
                                b[c] = a
                            }
                            return b
                        }

                        function d(a, b, c, d) {
                            var f = e, g = d + c;
                            a = -1 ^ a;
                            for (var h = d; g > h; h++) a = a >>> 8 ^ f[255 & (a ^ b[h])];
                            return -1 ^ a
                        }

                        var e = c();
                        b.exports = d
                    }, {}], 32: [function (a, b, c) {
                        "use strict";

                        function d(a, b) {
                            return a.msg = G[b], b
                        }

                        function e(a) {
                            return (a << 1) - (a > 4 ? 9 : 0)
                        }

                        function f(a) {
                            for (var b = a.length; --b >= 0;) a[b] = 0
                        }

                        function g(a) {
                            var b = a.state, c = b.pending;
                            c > a.avail_out && (c = a.avail_out), 0 !== c && (C.arraySet(a.output, b.pending_buf, b.pending_out, c, a.next_out), a.next_out += c, b.pending_out += c, a.total_out += c, a.avail_out -= c, b.pending -= c, 0 === b.pending && (b.pending_out = 0))
                        }

                        function h(a, b) {
                            D._tr_flush_block(a, a.block_start >= 0 ? a.block_start : -1, a.strstart - a.block_start, b), a.block_start = a.strstart, g(a.strm)
                        }

                        function i(a, b) {
                            a.pending_buf[a.pending++] = b
                        }

                        function j(a, b) {
                            a.pending_buf[a.pending++] = b >>> 8 & 255, a.pending_buf[a.pending++] = 255 & b
                        }

                        function k(a, b, c, d) {
                            var e = a.avail_in;
                            return e > d && (e = d), 0 === e ? 0 : (a.avail_in -= e, C.arraySet(b, a.input, a.next_in, e, c), 1 === a.state.wrap ? a.adler = E(a.adler, b, e, c) : 2 === a.state.wrap && (a.adler = F(a.adler, b, e, c)), a.next_in += e, a.total_in += e, e)
                        }

                        function l(a, b) {
                            var c, d, e = a.max_chain_length, f = a.strstart, g = a.prev_length, h = a.nice_match, i = a.strstart > a.w_size - jb ? a.strstart - (a.w_size - jb) : 0, j = a.window, k = a.w_mask, l = a.prev, m = a.strstart + ib, n = j[f + g - 1], o = j[f + g];
                            a.prev_length >= a.good_match && (e >>= 2), h > a.lookahead && (h = a.lookahead);
                            do if (c = b, j[c + g] === o && j[c + g - 1] === n && j[c] === j[f] && j[++c] === j[f + 1]) {
                                f += 2, c++;
                                do ; while (j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && j[++f] === j[++c] && m > f);
                                if (d = ib - (m - f), f = m - ib, d > g) {
                                    if (a.match_start = b, g = d, d >= h) break;
                                    n = j[f + g - 1], o = j[f + g]
                                }
                            } while ((b = l[b & k]) > i && 0 !== --e);
                            return g <= a.lookahead ? g : a.lookahead
                        }

                        function m(a) {
                            var b, c, d, e, f, g = a.w_size;
                            do {
                                if (e = a.window_size - a.lookahead - a.strstart, a.strstart >= g + (g - jb)) {
                                    C.arraySet(a.window, a.window, g, g, 0), a.match_start -= g, a.strstart -= g, a.block_start -= g, c = a.hash_size, b = c;
                                    do d = a.head[--b], a.head[b] = d >= g ? d - g : 0; while (--c);
                                    c = g, b = c;
                                    do d = a.prev[--b], a.prev[b] = d >= g ? d - g : 0; while (--c);
                                    e += g
                                }
                                if (0 === a.strm.avail_in) break;
                                if (c = k(a.strm, a.window, a.strstart + a.lookahead, e), a.lookahead += c, a.lookahead + a.insert >= hb) for (f = a.strstart - a.insert, a.ins_h = a.window[f], a.ins_h = (a.ins_h << a.hash_shift ^ a.window[f + 1]) & a.hash_mask; a.insert && (a.ins_h = (a.ins_h << a.hash_shift ^ a.window[f + hb - 1]) & a.hash_mask, a.prev[f & a.w_mask] = a.head[a.ins_h], a.head[a.ins_h] = f, f++, a.insert--, !(a.lookahead + a.insert < hb));) ;
                            } while (a.lookahead < jb && 0 !== a.strm.avail_in)
                        }

                        function n(a, b) {
                            var c = 65535;
                            for (c > a.pending_buf_size - 5 && (c = a.pending_buf_size - 5); ;) {
                                if (a.lookahead <= 1) {
                                    if (m(a), 0 === a.lookahead && b === H) return sb;
                                    if (0 === a.lookahead) break
                                }
                                a.strstart += a.lookahead, a.lookahead = 0;
                                var d = a.block_start + c;
                                if ((0 === a.strstart || a.strstart >= d) && (a.lookahead = a.strstart - d, a.strstart = d, h(a, !1), 0 === a.strm.avail_out)) return sb;
                                if (a.strstart - a.block_start >= a.w_size - jb && (h(a, !1), 0 === a.strm.avail_out)) return sb
                            }
                            return a.insert = 0, b === K ? (h(a, !0), 0 === a.strm.avail_out ? ub : vb) : a.strstart > a.block_start && (h(a, !1), 0 === a.strm.avail_out) ? sb : sb
                        }

                        function o(a, b) {
                            for (var c, d; ;) {
                                if (a.lookahead < jb) {
                                    if (m(a), a.lookahead < jb && b === H) return sb;
                                    if (0 === a.lookahead) break
                                }
                                if (c = 0, a.lookahead >= hb && (a.ins_h = (a.ins_h << a.hash_shift ^ a.window[a.strstart + hb - 1]) & a.hash_mask, c = a.prev[a.strstart & a.w_mask] = a.head[a.ins_h], a.head[a.ins_h] = a.strstart), 0 !== c && a.strstart - c <= a.w_size - jb && (a.match_length = l(a, c)), a.match_length >= hb) if (d = D._tr_tally(a, a.strstart - a.match_start, a.match_length - hb), a.lookahead -= a.match_length, a.match_length <= a.max_lazy_match && a.lookahead >= hb) {
                                    a.match_length--;
                                    do a.strstart++, a.ins_h = (a.ins_h << a.hash_shift ^ a.window[a.strstart + hb - 1]) & a.hash_mask, c = a.prev[a.strstart & a.w_mask] = a.head[a.ins_h], a.head[a.ins_h] = a.strstart; while (0 !== --a.match_length);
                                    a.strstart++
                                } else a.strstart += a.match_length, a.match_length = 0, a.ins_h = a.window[a.strstart], a.ins_h = (a.ins_h << a.hash_shift ^ a.window[a.strstart + 1]) & a.hash_mask; else d = D._tr_tally(a, 0, a.window[a.strstart]), a.lookahead--, a.strstart++;
                                if (d && (h(a, !1), 0 === a.strm.avail_out)) return sb
                            }
                            return a.insert = a.strstart < hb - 1 ? a.strstart : hb - 1, b === K ? (h(a, !0), 0 === a.strm.avail_out ? ub : vb) : a.last_lit && (h(a, !1), 0 === a.strm.avail_out) ? sb : tb
                        }

                        function p(a, b) {
                            for (var c, d, e; ;) {
                                if (a.lookahead < jb) {
                                    if (m(a), a.lookahead < jb && b === H) return sb;
                                    if (0 === a.lookahead) break
                                }
                                if (c = 0, a.lookahead >= hb && (a.ins_h = (a.ins_h << a.hash_shift ^ a.window[a.strstart + hb - 1]) & a.hash_mask, c = a.prev[a.strstart & a.w_mask] = a.head[a.ins_h], a.head[a.ins_h] = a.strstart), a.prev_length = a.match_length, a.prev_match = a.match_start, a.match_length = hb - 1, 0 !== c && a.prev_length < a.max_lazy_match && a.strstart - c <= a.w_size - jb && (a.match_length = l(a, c), a.match_length <= 5 && (a.strategy === S || a.match_length === hb && a.strstart - a.match_start > 4096) && (a.match_length = hb - 1)), a.prev_length >= hb && a.match_length <= a.prev_length) {
                                    e = a.strstart + a.lookahead - hb, d = D._tr_tally(a, a.strstart - 1 - a.prev_match, a.prev_length - hb), a.lookahead -= a.prev_length - 1, a.prev_length -= 2;
                                    do ++a.strstart <= e && (a.ins_h = (a.ins_h << a.hash_shift ^ a.window[a.strstart + hb - 1]) & a.hash_mask, c = a.prev[a.strstart & a.w_mask] = a.head[a.ins_h], a.head[a.ins_h] = a.strstart); while (0 !== --a.prev_length);
                                    if (a.match_available = 0, a.match_length = hb - 1, a.strstart++, d && (h(a, !1), 0 === a.strm.avail_out)) return sb
                                } else if (a.match_available) {
                                    if (d = D._tr_tally(a, 0, a.window[a.strstart - 1]), d && h(a, !1), a.strstart++, a.lookahead--, 0 === a.strm.avail_out) return sb
                                } else a.match_available = 1, a.strstart++, a.lookahead--
                            }
                            return a.match_available && (d = D._tr_tally(a, 0, a.window[a.strstart - 1]), a.match_available = 0), a.insert = a.strstart < hb - 1 ? a.strstart : hb - 1, b === K ? (h(a, !0), 0 === a.strm.avail_out ? ub : vb) : a.last_lit && (h(a, !1), 0 === a.strm.avail_out) ? sb : tb
                        }

                        function q(a, b) {
                            for (var c, d, e, f, g = a.window; ;) {
                                if (a.lookahead <= ib) {
                                    if (m(a), a.lookahead <= ib && b === H) return sb;
                                    if (0 === a.lookahead) break
                                }
                                if (a.match_length = 0, a.lookahead >= hb && a.strstart > 0 && (e = a.strstart - 1, d = g[e], d === g[++e] && d === g[++e] && d === g[++e])) {
                                    f = a.strstart + ib;
                                    do ; while (d === g[++e] && d === g[++e] && d === g[++e] && d === g[++e] && d === g[++e] && d === g[++e] && d === g[++e] && d === g[++e] && f > e);
                                    a.match_length = ib - (f - e), a.match_length > a.lookahead && (a.match_length = a.lookahead)
                                }
                                if (a.match_length >= hb ? (c = D._tr_tally(a, 1, a.match_length - hb), a.lookahead -= a.match_length, a.strstart += a.match_length, a.match_length = 0) : (c = D._tr_tally(a, 0, a.window[a.strstart]), a.lookahead--, a.strstart++), c && (h(a, !1), 0 === a.strm.avail_out)) return sb
                            }
                            return a.insert = 0, b === K ? (h(a, !0), 0 === a.strm.avail_out ? ub : vb) : a.last_lit && (h(a, !1), 0 === a.strm.avail_out) ? sb : tb
                        }

                        function r(a, b) {
                            for (var c; ;) {
                                if (0 === a.lookahead && (m(a), 0 === a.lookahead)) {
                                    if (b === H) return sb;
                                    break
                                }
                                if (a.match_length = 0, c = D._tr_tally(a, 0, a.window[a.strstart]), a.lookahead--, a.strstart++, c && (h(a, !1), 0 === a.strm.avail_out)) return sb
                            }
                            return a.insert = 0, b === K ? (h(a, !0), 0 === a.strm.avail_out ? ub : vb) : a.last_lit && (h(a, !1), 0 === a.strm.avail_out) ? sb : tb
                        }

                        function s(a) {
                            a.window_size = 2 * a.w_size, f(a.head), a.max_lazy_match = B[a.level].max_lazy, a.good_match = B[a.level].good_length, a.nice_match = B[a.level].nice_length, a.max_chain_length = B[a.level].max_chain, a.strstart = 0, a.block_start = 0, a.lookahead = 0, a.insert = 0, a.match_length = a.prev_length = hb - 1, a.match_available = 0, a.ins_h = 0
                        }

                        function t() {
                            this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = Y, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new C.Buf16(2 * fb), this.dyn_dtree = new C.Buf16(2 * (2 * db + 1)), this.bl_tree = new C.Buf16(2 * (2 * eb + 1)), f(this.dyn_ltree), f(this.dyn_dtree), f(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new C.Buf16(gb + 1), this.heap = new C.Buf16(2 * cb + 1), f(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new C.Buf16(2 * cb + 1), f(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0
                        }

                        function u(a) {
                            var b;
                            return a && a.state ? (a.total_in = a.total_out = 0, a.data_type = X, b = a.state, b.pending = 0, b.pending_out = 0, b.wrap < 0 && (b.wrap = -b.wrap), b.status = b.wrap ? lb : qb, a.adler = 2 === b.wrap ? 0 : 1, b.last_flush = H, D._tr_init(b), M) : d(a, O)
                        }

                        function v(a) {
                            var b = u(a);
                            return b === M && s(a.state), b
                        }

                        function w(a, b) {
                            return a && a.state ? 2 !== a.state.wrap ? O : (a.state.gzhead = b, M) : O
                        }

                        function x(a, b, c, e, f, g) {
                            if (!a) return O;
                            var h = 1;
                            if (b === R && (b = 6), 0 > e ? (h = 0, e = -e) : e > 15 && (h = 2, e -= 16), 1 > f || f > Z || c !== Y || 8 > e || e > 15 || 0 > b || b > 9 || 0 > g || g > V) return d(a, O);
                            8 === e && (e = 9);
                            var i = new t;
                            return a.state = i, i.strm = a, i.wrap = h, i.gzhead = null, i.w_bits = e, i.w_size = 1 << i.w_bits, i.w_mask = i.w_size - 1, i.hash_bits = f + 7, i.hash_size = 1 << i.hash_bits, i.hash_mask = i.hash_size - 1, i.hash_shift = ~~((i.hash_bits + hb - 1) / hb), i.window = new C.Buf8(2 * i.w_size), i.head = new C.Buf16(i.hash_size), i.prev = new C.Buf16(i.w_size), i.lit_bufsize = 1 << f + 6, i.pending_buf_size = 4 * i.lit_bufsize, i.pending_buf = new C.Buf8(i.pending_buf_size), i.d_buf = i.lit_bufsize >> 1, i.l_buf = 3 * i.lit_bufsize, i.level = b, i.strategy = g, i.method = c, v(a)
                        }

                        function y(a, b) {
                            return x(a, b, Y, $, _, W)
                        }

                        function z(a, b) {
                            var c, h, k, l;
                            if (!a || !a.state || b > L || 0 > b) return a ? d(a, O) : O;
                            if (h = a.state, !a.output || !a.input && 0 !== a.avail_in || h.status === rb && b !== K) return d(a, 0 === a.avail_out ? Q : O);
                            if (h.strm = a, c = h.last_flush, h.last_flush = b, h.status === lb) if (2 === h.wrap) a.adler = 0, i(h, 31), i(h, 139), i(h, 8), h.gzhead ? (i(h, (h.gzhead.text ? 1 : 0) + (h.gzhead.hcrc ? 2 : 0) + (h.gzhead.extra ? 4 : 0) + (h.gzhead.name ? 8 : 0) + (h.gzhead.comment ? 16 : 0)), i(h, 255 & h.gzhead.time), i(h, h.gzhead.time >> 8 & 255), i(h, h.gzhead.time >> 16 & 255), i(h, h.gzhead.time >> 24 & 255), i(h, 9 === h.level ? 2 : h.strategy >= T || h.level < 2 ? 4 : 0), i(h, 255 & h.gzhead.os), h.gzhead.extra && h.gzhead.extra.length && (i(h, 255 & h.gzhead.extra.length), i(h, h.gzhead.extra.length >> 8 & 255)), h.gzhead.hcrc && (a.adler = F(a.adler, h.pending_buf, h.pending, 0)), h.gzindex = 0, h.status = mb) : (i(h, 0), i(h, 0), i(h, 0), i(h, 0), i(h, 0), i(h, 9 === h.level ? 2 : h.strategy >= T || h.level < 2 ? 4 : 0), i(h, wb), h.status = qb); else {
                                var m = Y + (h.w_bits - 8 << 4) << 8, n = -1;
                                n = h.strategy >= T || h.level < 2 ? 0 : h.level < 6 ? 1 : 6 === h.level ? 2 : 3, m |= n << 6, 0 !== h.strstart && (m |= kb), m += 31 - m % 31, h.status = qb, j(h, m), 0 !== h.strstart && (j(h, a.adler >>> 16), j(h, 65535 & a.adler)), a.adler = 1
                            }
                            if (h.status === mb) if (h.gzhead.extra) {
                                for (k = h.pending; h.gzindex < (65535 & h.gzhead.extra.length) && (h.pending !== h.pending_buf_size || (h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), g(a), k = h.pending, h.pending !== h.pending_buf_size));) i(h, 255 & h.gzhead.extra[h.gzindex]), h.gzindex++;
                                h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), h.gzindex === h.gzhead.extra.length && (h.gzindex = 0, h.status = nb)
                            } else h.status = nb;
                            if (h.status === nb) if (h.gzhead.name) {
                                k = h.pending;
                                do {
                                    if (h.pending === h.pending_buf_size && (h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), g(a), k = h.pending, h.pending === h.pending_buf_size)) {
                                        l = 1;
                                        break
                                    }
                                    l = h.gzindex < h.gzhead.name.length ? 255 & h.gzhead.name.charCodeAt(h.gzindex++) : 0, i(h, l)
                                } while (0 !== l);
                                h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), 0 === l && (h.gzindex = 0, h.status = ob)
                            } else h.status = ob;
                            if (h.status === ob) if (h.gzhead.comment) {
                                k = h.pending;
                                do {
                                    if (h.pending === h.pending_buf_size && (h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), g(a), k = h.pending, h.pending === h.pending_buf_size)) {
                                        l = 1;
                                        break
                                    }
                                    l = h.gzindex < h.gzhead.comment.length ? 255 & h.gzhead.comment.charCodeAt(h.gzindex++) : 0, i(h, l)
                                } while (0 !== l);
                                h.gzhead.hcrc && h.pending > k && (a.adler = F(a.adler, h.pending_buf, h.pending - k, k)), 0 === l && (h.status = pb)
                            } else h.status = pb;
                            if (h.status === pb && (h.gzhead.hcrc ? (h.pending + 2 > h.pending_buf_size && g(a), h.pending + 2 <= h.pending_buf_size && (i(h, 255 & a.adler), i(h, a.adler >> 8 & 255), a.adler = 0, h.status = qb)) : h.status = qb), 0 !== h.pending) {
                                if (g(a), 0 === a.avail_out) return h.last_flush = -1, M
                            } else if (0 === a.avail_in && e(b) <= e(c) && b !== K) return d(a, Q);
                            if (h.status === rb && 0 !== a.avail_in) return d(a, Q);
                            if (0 !== a.avail_in || 0 !== h.lookahead || b !== H && h.status !== rb) {
                                var o = h.strategy === T ? r(h, b) : h.strategy === U ? q(h, b) : B[h.level].func(h, b);
                                if ((o === ub || o === vb) && (h.status = rb), o === sb || o === ub) return 0 === a.avail_out && (h.last_flush = -1), M;
                                if (o === tb && (b === I ? D._tr_align(h) : b !== L && (D._tr_stored_block(h, 0, 0, !1), b === J && (f(h.head), 0 === h.lookahead && (h.strstart = 0, h.block_start = 0, h.insert = 0))), g(a), 0 === a.avail_out)) return h.last_flush = -1, M
                            }
                            return b !== K ? M : h.wrap <= 0 ? N : (2 === h.wrap ? (i(h, 255 & a.adler), i(h, a.adler >> 8 & 255), i(h, a.adler >> 16 & 255), i(h, a.adler >> 24 & 255), i(h, 255 & a.total_in), i(h, a.total_in >> 8 & 255), i(h, a.total_in >> 16 & 255), i(h, a.total_in >> 24 & 255)) : (j(h, a.adler >>> 16), j(h, 65535 & a.adler)), g(a), h.wrap > 0 && (h.wrap = -h.wrap), 0 !== h.pending ? M : N)
                        }

                        function A(a) {
                            var b;
                            return a && a.state ? (b = a.state.status, b !== lb && b !== mb && b !== nb && b !== ob && b !== pb && b !== qb && b !== rb ? d(a, O) : (a.state = null, b === qb ? d(a, P) : M)) : O
                        }

                        var B, C = a("../utils/common"), D = a("./trees"), E = a("./adler32"), F = a("./crc32"), G = a("./messages"), H = 0, I = 1, J = 3, K = 4, L = 5, M = 0, N = 1, O = -2, P = -3, Q = -5, R = -1, S = 1, T = 2, U = 3, V = 4, W = 0, X = 2, Y = 8, Z = 9, $ = 15, _ = 8, ab = 29, bb = 256, cb = bb + 1 + ab, db = 30, eb = 19, fb = 2 * cb + 1, gb = 15, hb = 3, ib = 258, jb = ib + hb + 1, kb = 32, lb = 42, mb = 69, nb = 73, ob = 91, pb = 103, qb = 113, rb = 666, sb = 1, tb = 2, ub = 3, vb = 4,
                            wb = 3, xb = function (a, b, c, d, e) {
                                this.good_length = a, this.max_lazy = b, this.nice_length = c, this.max_chain = d, this.func = e
                            };
                        B = [new xb(0, 0, 0, 0, n), new xb(4, 4, 8, 4, o), new xb(4, 5, 16, 8, o), new xb(4, 6, 32, 32, o), new xb(4, 4, 16, 16, p), new xb(8, 16, 32, 32, p), new xb(8, 16, 128, 128, p), new xb(8, 32, 128, 256, p), new xb(32, 128, 258, 1024, p), new xb(32, 258, 258, 4096, p)], c.deflateInit = y, c.deflateInit2 = x, c.deflateReset = v, c.deflateResetKeep = u, c.deflateSetHeader = w, c.deflate = z, c.deflateEnd = A, c.deflateInfo = "pako deflate (from Nodeca project)"
                    }, {"../utils/common": 27, "./adler32": 29, "./crc32": 31, "./messages": 37, "./trees": 38}], 33: [function (a, b) {
                        "use strict";

                        function c() {
                            this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1
                        }

                        b.exports = c
                    }, {}], 34: [function (a, b) {
                        "use strict";
                        var c = 30, d = 12;
                        b.exports = function (a, b) {
                            var e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z, A, B, C;
                            e = a.state, f = a.next_in, B = a.input, g = f + (a.avail_in - 5), h = a.next_out, C = a.output, i = h - (b - a.avail_out), j = h + (a.avail_out - 257), k = e.dmax, l = e.wsize, m = e.whave, n = e.wnext, o = e.window, p = e.hold, q = e.bits, r = e.lencode, s = e.distcode, t = (1 << e.lenbits) - 1, u = (1 << e.distbits) - 1;
                            a:do {
                                15 > q && (p += B[f++] << q, q += 8, p += B[f++] << q, q += 8), v = r[p & t];
                                b:for (; ;) {
                                    if (w = v >>> 24, p >>>= w, q -= w, w = v >>> 16 & 255, 0 === w) C[h++] = 65535 & v; else {
                                        if (!(16 & w)) {
                                            if (0 === (64 & w)) {
                                                v = r[(65535 & v) + (p & (1 << w) - 1)];
                                                continue b
                                            }
                                            if (32 & w) {
                                                e.mode = d;
                                                break a
                                            }
                                            a.msg = "invalid literal/length code", e.mode = c;
                                            break a
                                        }
                                        x = 65535 & v, w &= 15, w && (w > q && (p += B[f++] << q, q += 8), x += p & (1 << w) - 1, p >>>= w, q -= w), 15 > q && (p += B[f++] << q, q += 8, p += B[f++] << q, q += 8), v = s[p & u];
                                        c:for (; ;) {
                                            if (w = v >>> 24, p >>>= w, q -= w, w = v >>> 16 & 255, !(16 & w)) {
                                                if (0 === (64 & w)) {
                                                    v = s[(65535 & v) + (p & (1 << w) - 1)];
                                                    continue c
                                                }
                                                a.msg = "invalid distance code", e.mode = c;
                                                break a
                                            }
                                            if (y = 65535 & v, w &= 15, w > q && (p += B[f++] << q, q += 8, w > q && (p += B[f++] << q, q += 8)), y += p & (1 << w) - 1, y > k) {
                                                a.msg = "invalid distance too far back", e.mode = c;
                                                break a
                                            }
                                            if (p >>>= w, q -= w, w = h - i, y > w) {
                                                if (w = y - w, w > m && e.sane) {
                                                    a.msg = "invalid distance too far back", e.mode = c;
                                                    break a
                                                }
                                                if (z = 0, A = o, 0 === n) {
                                                    if (z += l - w, x > w) {
                                                        x -= w;
                                                        do C[h++] = o[z++]; while (--w);
                                                        z = h - y, A = C
                                                    }
                                                } else if (w > n) {
                                                    if (z += l + n - w, w -= n, x > w) {
                                                        x -= w;
                                                        do C[h++] = o[z++]; while (--w);
                                                        if (z = 0, x > n) {
                                                            w = n, x -= w;
                                                            do C[h++] = o[z++]; while (--w);
                                                            z = h - y, A = C
                                                        }
                                                    }
                                                } else if (z += n - w, x > w) {
                                                    x -= w;
                                                    do C[h++] = o[z++]; while (--w);
                                                    z = h - y, A = C
                                                }
                                                for (; x > 2;) C[h++] = A[z++], C[h++] = A[z++], C[h++] = A[z++], x -= 3;
                                                x && (C[h++] = A[z++], x > 1 && (C[h++] = A[z++]))
                                            } else {
                                                z = h - y;
                                                do C[h++] = C[z++], C[h++] = C[z++], C[h++] = C[z++], x -= 3; while (x > 2);
                                                x && (C[h++] = C[z++], x > 1 && (C[h++] = C[z++]))
                                            }
                                            break
                                        }
                                    }
                                    break
                                }
                            } while (g > f && j > h);
                            x = q >> 3, f -= x, q -= x << 3, p &= (1 << q) - 1, a.next_in = f, a.next_out = h, a.avail_in = g > f ? 5 + (g - f) : 5 - (f - g), a.avail_out = j > h ? 257 + (j - h) : 257 - (h - j), e.hold = p, e.bits = q
                        }
                    }, {}], 35: [function (a, b, c) {
                        "use strict";

                        function d(a) {
                            return (a >>> 24 & 255) + (a >>> 8 & 65280) + ((65280 & a) << 8) + ((255 & a) << 24)
                        }

                        function e() {
                            this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new r.Buf16(320), this.work = new r.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0
                        }

                        function f(a) {
                            var b;
                            return a && a.state ? (b = a.state, a.total_in = a.total_out = b.total = 0, a.msg = "", b.wrap && (a.adler = 1 & b.wrap), b.mode = K, b.last = 0, b.havedict = 0, b.dmax = 32768, b.head = null, b.hold = 0, b.bits = 0, b.lencode = b.lendyn = new r.Buf32(ob), b.distcode = b.distdyn = new r.Buf32(pb), b.sane = 1, b.back = -1, C) : F
                        }

                        function g(a) {
                            var b;
                            return a && a.state ? (b = a.state, b.wsize = 0, b.whave = 0, b.wnext = 0, f(a)) : F
                        }

                        function h(a, b) {
                            var c, d;
                            return a && a.state ? (d = a.state, 0 > b ? (c = 0, b = -b) : (c = (b >> 4) + 1, 48 > b && (b &= 15)), b && (8 > b || b > 15) ? F : (null !== d.window && d.wbits !== b && (d.window = null), d.wrap = c, d.wbits = b, g(a))) : F
                        }

                        function i(a, b) {
                            var c, d;
                            return a ? (d = new e, a.state = d, d.window = null, c = h(a, b), c !== C && (a.state = null), c) : F
                        }

                        function j(a) {
                            return i(a, rb)
                        }

                        function k(a) {
                            if (sb) {
                                var b;
                                for (p = new r.Buf32(512), q = new r.Buf32(32), b = 0; 144 > b;) a.lens[b++] = 8;
                                for (; 256 > b;) a.lens[b++] = 9;
                                for (; 280 > b;) a.lens[b++] = 7;
                                for (; 288 > b;) a.lens[b++] = 8;
                                for (v(x, a.lens, 0, 288, p, 0, a.work, {bits: 9}), b = 0; 32 > b;) a.lens[b++] = 5;
                                v(y, a.lens, 0, 32, q, 0, a.work, {bits: 5}), sb = !1
                            }
                            a.lencode = p, a.lenbits = 9, a.distcode = q, a.distbits = 5
                        }

                        function l(a, b, c, d) {
                            var e, f = a.state;
                            return null === f.window && (f.wsize = 1 << f.wbits, f.wnext = 0, f.whave = 0, f.window = new r.Buf8(f.wsize)), d >= f.wsize ? (r.arraySet(f.window, b, c - f.wsize, f.wsize, 0), f.wnext = 0, f.whave = f.wsize) : (e = f.wsize - f.wnext, e > d && (e = d), r.arraySet(f.window, b, c - d, e, f.wnext), d -= e, d ? (r.arraySet(f.window, b, c - d, d, 0), f.wnext = d, f.whave = f.wsize) : (f.wnext += e, f.wnext === f.wsize && (f.wnext = 0), f.whave < f.wsize && (f.whave += e))), 0
                        }

                        function m(a, b) {
                            var c, e, f, g, h, i, j, m, n, o, p, q, ob, pb, qb, rb, sb, tb, ub, vb, wb, xb, yb, zb, Ab = 0, Bb = new r.Buf8(4), Cb = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
                            if (!a || !a.state || !a.output || !a.input && 0 !== a.avail_in) return F;
                            c = a.state, c.mode === V && (c.mode = W), h = a.next_out, f = a.output, j = a.avail_out, g = a.next_in, e = a.input, i = a.avail_in, m = c.hold, n = c.bits, o = i, p = j, xb = C;
                            a:for (; ;) switch (c.mode) {
                                case K:
                                    if (0 === c.wrap) {
                                        c.mode = W;
                                        break
                                    }
                                    for (; 16 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if (2 & c.wrap && 35615 === m) {
                                        c.check = 0, Bb[0] = 255 & m, Bb[1] = m >>> 8 & 255, c.check = t(c.check, Bb, 2, 0), m = 0, n = 0, c.mode = L;
                                        break
                                    }
                                    if (c.flags = 0, c.head && (c.head.done = !1), !(1 & c.wrap) || (((255 & m) << 8) + (m >> 8)) % 31) {
                                        a.msg = "incorrect header check", c.mode = lb;
                                        break
                                    }
                                    if ((15 & m) !== J) {
                                        a.msg = "unknown compression method", c.mode = lb;
                                        break
                                    }
                                    if (m >>>= 4, n -= 4, wb = (15 & m) + 8, 0 === c.wbits) c.wbits = wb; else if (wb > c.wbits) {
                                        a.msg = "invalid window size", c.mode = lb;
                                        break
                                    }
                                    c.dmax = 1 << wb, a.adler = c.check = 1, c.mode = 512 & m ? T : V, m = 0, n = 0;
                                    break;
                                case L:
                                    for (; 16 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if (c.flags = m, (255 & c.flags) !== J) {
                                        a.msg = "unknown compression method", c.mode = lb;
                                        break
                                    }
                                    if (57344 & c.flags) {
                                        a.msg = "unknown header flags set", c.mode = lb;
                                        break
                                    }
                                    c.head && (c.head.text = m >> 8 & 1), 512 & c.flags && (Bb[0] = 255 & m, Bb[1] = m >>> 8 & 255, c.check = t(c.check, Bb, 2, 0)), m = 0, n = 0, c.mode = M;
                                case M:
                                    for (; 32 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    c.head && (c.head.time = m), 512 & c.flags && (Bb[0] = 255 & m, Bb[1] = m >>> 8 & 255, Bb[2] = m >>> 16 & 255, Bb[3] = m >>> 24 & 255, c.check = t(c.check, Bb, 4, 0)), m = 0, n = 0, c.mode = N;
                                case N:
                                    for (; 16 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    c.head && (c.head.xflags = 255 & m, c.head.os = m >> 8), 512 & c.flags && (Bb[0] = 255 & m, Bb[1] = m >>> 8 & 255, c.check = t(c.check, Bb, 2, 0)), m = 0, n = 0, c.mode = O;
                                case O:
                                    if (1024 & c.flags) {
                                        for (; 16 > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        c.length = m, c.head && (c.head.extra_len = m), 512 & c.flags && (Bb[0] = 255 & m, Bb[1] = m >>> 8 & 255, c.check = t(c.check, Bb, 2, 0)), m = 0, n = 0
                                    } else c.head && (c.head.extra = null);
                                    c.mode = P;
                                case P:
                                    if (1024 & c.flags && (q = c.length, q > i && (q = i), q && (c.head && (wb = c.head.extra_len - c.length, c.head.extra || (c.head.extra = new Array(c.head.extra_len)), r.arraySet(c.head.extra, e, g, q, wb)), 512 & c.flags && (c.check = t(c.check, e, q, g)), i -= q, g += q, c.length -= q), c.length)) break a;
                                    c.length = 0, c.mode = Q;
                                case Q:
                                    if (2048 & c.flags) {
                                        if (0 === i) break a;
                                        q = 0;
                                        do wb = e[g + q++], c.head && wb && c.length < 65536 && (c.head.name += String.fromCharCode(wb)); while (wb && i > q);
                                        if (512 & c.flags && (c.check = t(c.check, e, q, g)), i -= q, g += q, wb) break a
                                    } else c.head && (c.head.name = null);
                                    c.length = 0, c.mode = R;
                                case R:
                                    if (4096 & c.flags) {
                                        if (0 === i) break a;
                                        q = 0;
                                        do wb = e[g + q++], c.head && wb && c.length < 65536 && (c.head.comment += String.fromCharCode(wb)); while (wb && i > q);
                                        if (512 & c.flags && (c.check = t(c.check, e, q, g)), i -= q, g += q, wb) break a
                                    } else c.head && (c.head.comment = null);
                                    c.mode = S;
                                case S:
                                    if (512 & c.flags) {
                                        for (; 16 > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        if (m !== (65535 & c.check)) {
                                            a.msg = "header crc mismatch", c.mode = lb;
                                            break
                                        }
                                        m = 0, n = 0
                                    }
                                    c.head && (c.head.hcrc = c.flags >> 9 & 1, c.head.done = !0), a.adler = c.check = 0, c.mode = V;
                                    break;
                                case T:
                                    for (; 32 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    a.adler = c.check = d(m), m = 0, n = 0, c.mode = U;
                                case U:
                                    if (0 === c.havedict) return a.next_out = h, a.avail_out = j, a.next_in = g, a.avail_in = i, c.hold = m, c.bits = n, E;
                                    a.adler = c.check = 1, c.mode = V;
                                case V:
                                    if (b === A || b === B) break a;
                                case W:
                                    if (c.last) {
                                        m >>>= 7 & n, n -= 7 & n, c.mode = ib;
                                        break
                                    }
                                    for (; 3 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    switch (c.last = 1 & m, m >>>= 1, n -= 1, 3 & m) {
                                        case 0:
                                            c.mode = X;
                                            break;
                                        case 1:
                                            if (k(c), c.mode = bb, b === B) {
                                                m >>>= 2, n -= 2;
                                                break a
                                            }
                                            break;
                                        case 2:
                                            c.mode = $;
                                            break;
                                        case 3:
                                            a.msg = "invalid block type", c.mode = lb
                                    }
                                    m >>>= 2, n -= 2;
                                    break;
                                case X:
                                    for (m >>>= 7 & n, n -= 7 & n; 32 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if ((65535 & m) !== (m >>> 16 ^ 65535)) {
                                        a.msg = "invalid stored block lengths", c.mode = lb;
                                        break
                                    }
                                    if (c.length = 65535 & m, m = 0, n = 0, c.mode = Y, b === B) break a;
                                case Y:
                                    c.mode = Z;
                                case Z:
                                    if (q = c.length) {
                                        if (q > i && (q = i), q > j && (q = j), 0 === q) break a;
                                        r.arraySet(f, e, g, q, h), i -= q, g += q, j -= q, h += q, c.length -= q;
                                        break
                                    }
                                    c.mode = V;
                                    break;
                                case $:
                                    for (; 14 > n;) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if (c.nlen = (31 & m) + 257, m >>>= 5, n -= 5, c.ndist = (31 & m) + 1, m >>>= 5, n -= 5, c.ncode = (15 & m) + 4, m >>>= 4, n -= 4, c.nlen > 286 || c.ndist > 30) {
                                        a.msg = "too many length or distance symbols", c.mode = lb;
                                        break
                                    }
                                    c.have = 0, c.mode = _;
                                case _:
                                    for (; c.have < c.ncode;) {
                                        for (; 3 > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        c.lens[Cb[c.have++]] = 7 & m, m >>>= 3, n -= 3
                                    }
                                    for (; c.have < 19;) c.lens[Cb[c.have++]] = 0;
                                    if (c.lencode = c.lendyn, c.lenbits = 7, yb = {bits: c.lenbits}, xb = v(w, c.lens, 0, 19, c.lencode, 0, c.work, yb), c.lenbits = yb.bits, xb) {
                                        a.msg = "invalid code lengths set", c.mode = lb;
                                        break
                                    }
                                    c.have = 0, c.mode = ab;
                                case ab:
                                    for (; c.have < c.nlen + c.ndist;) {
                                        for (; Ab = c.lencode[m & (1 << c.lenbits) - 1], qb = Ab >>> 24, rb = Ab >>> 16 & 255, sb = 65535 & Ab, !(n >= qb);) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        if (16 > sb) m >>>= qb, n -= qb, c.lens[c.have++] = sb; else {
                                            if (16 === sb) {
                                                for (zb = qb + 2; zb > n;) {
                                                    if (0 === i) break a;
                                                    i--, m += e[g++] << n, n += 8
                                                }
                                                if (m >>>= qb, n -= qb, 0 === c.have) {
                                                    a.msg = "invalid bit length repeat", c.mode = lb;
                                                    break
                                                }
                                                wb = c.lens[c.have - 1], q = 3 + (3 & m), m >>>= 2, n -= 2
                                            } else if (17 === sb) {
                                                for (zb = qb + 3; zb > n;) {
                                                    if (0 === i) break a;
                                                    i--, m += e[g++] << n, n += 8
                                                }
                                                m >>>= qb, n -= qb, wb = 0, q = 3 + (7 & m), m >>>= 3, n -= 3
                                            } else {
                                                for (zb = qb + 7; zb > n;) {
                                                    if (0 === i) break a;
                                                    i--, m += e[g++] << n, n += 8
                                                }
                                                m >>>= qb, n -= qb, wb = 0, q = 11 + (127 & m), m >>>= 7, n -= 7
                                            }
                                            if (c.have + q > c.nlen + c.ndist) {
                                                a.msg = "invalid bit length repeat", c.mode = lb;
                                                break
                                            }
                                            for (; q--;) c.lens[c.have++] = wb
                                        }
                                    }
                                    if (c.mode === lb) break;
                                    if (0 === c.lens[256]) {
                                        a.msg = "invalid code -- missing end-of-block", c.mode = lb;
                                        break
                                    }
                                    if (c.lenbits = 9, yb = {bits: c.lenbits}, xb = v(x, c.lens, 0, c.nlen, c.lencode, 0, c.work, yb), c.lenbits = yb.bits, xb) {
                                        a.msg = "invalid literal/lengths set", c.mode = lb;
                                        break
                                    }
                                    if (c.distbits = 6, c.distcode = c.distdyn, yb = {bits: c.distbits}, xb = v(y, c.lens, c.nlen, c.ndist, c.distcode, 0, c.work, yb), c.distbits = yb.bits, xb) {
                                        a.msg = "invalid distances set", c.mode = lb;
                                        break
                                    }
                                    if (c.mode = bb, b === B) break a;
                                case bb:
                                    c.mode = cb;
                                case cb:
                                    if (i >= 6 && j >= 258) {
                                        a.next_out = h, a.avail_out = j, a.next_in = g, a.avail_in = i, c.hold = m, c.bits = n, u(a, p), h = a.next_out, f = a.output, j = a.avail_out, g = a.next_in, e = a.input, i = a.avail_in, m = c.hold, n = c.bits, c.mode === V && (c.back = -1);
                                        break
                                    }
                                    for (c.back = 0; Ab = c.lencode[m & (1 << c.lenbits) - 1], qb = Ab >>> 24, rb = Ab >>> 16 & 255, sb = 65535 & Ab, !(n >= qb);) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if (rb && 0 === (240 & rb)) {
                                        for (tb = qb, ub = rb, vb = sb; Ab = c.lencode[vb + ((m & (1 << tb + ub) - 1) >> tb)], qb = Ab >>> 24, rb = Ab >>> 16 & 255, sb = 65535 & Ab, !(n >= tb + qb);) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        m >>>= tb, n -= tb, c.back += tb
                                    }
                                    if (m >>>= qb, n -= qb, c.back += qb, c.length = sb, 0 === rb) {
                                        c.mode = hb;
                                        break
                                    }
                                    if (32 & rb) {
                                        c.back = -1, c.mode = V;
                                        break
                                    }
                                    if (64 & rb) {
                                        a.msg = "invalid literal/length code", c.mode = lb;
                                        break
                                    }
                                    c.extra = 15 & rb, c.mode = db;
                                case db:
                                    if (c.extra) {
                                        for (zb = c.extra; zb > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        c.length += m & (1 << c.extra) - 1, m >>>= c.extra, n -= c.extra, c.back += c.extra
                                    }
                                    c.was = c.length, c.mode = eb;
                                case eb:
                                    for (; Ab = c.distcode[m & (1 << c.distbits) - 1], qb = Ab >>> 24, rb = Ab >>> 16 & 255, sb = 65535 & Ab, !(n >= qb);) {
                                        if (0 === i) break a;
                                        i--, m += e[g++] << n, n += 8
                                    }
                                    if (0 === (240 & rb)) {
                                        for (tb = qb, ub = rb, vb = sb; Ab = c.distcode[vb + ((m & (1 << tb + ub) - 1) >> tb)], qb = Ab >>> 24, rb = Ab >>> 16 & 255, sb = 65535 & Ab, !(n >= tb + qb);) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        m >>>= tb, n -= tb, c.back += tb
                                    }
                                    if (m >>>= qb, n -= qb, c.back += qb, 64 & rb) {
                                        a.msg = "invalid distance code", c.mode = lb;
                                        break
                                    }
                                    c.offset = sb, c.extra = 15 & rb, c.mode = fb;
                                case fb:
                                    if (c.extra) {
                                        for (zb = c.extra; zb > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        c.offset += m & (1 << c.extra) - 1, m >>>= c.extra, n -= c.extra, c.back += c.extra
                                    }
                                    if (c.offset > c.dmax) {
                                        a.msg = "invalid distance too far back", c.mode = lb;
                                        break
                                    }
                                    c.mode = gb;
                                case gb:
                                    if (0 === j) break a;
                                    if (q = p - j, c.offset > q) {
                                        if (q = c.offset - q, q > c.whave && c.sane) {
                                            a.msg = "invalid distance too far back", c.mode = lb;
                                            break
                                        }
                                        q > c.wnext ? (q -= c.wnext, ob = c.wsize - q) : ob = c.wnext - q, q > c.length && (q = c.length), pb = c.window
                                    } else pb = f, ob = h - c.offset, q = c.length;
                                    q > j && (q = j), j -= q, c.length -= q;
                                    do f[h++] = pb[ob++]; while (--q);
                                    0 === c.length && (c.mode = cb);
                                    break;
                                case hb:
                                    if (0 === j) break a;
                                    f[h++] = c.length, j--, c.mode = cb;
                                    break;
                                case ib:
                                    if (c.wrap) {
                                        for (; 32 > n;) {
                                            if (0 === i) break a;
                                            i--, m |= e[g++] << n, n += 8
                                        }
                                        if (p -= j, a.total_out += p, c.total += p, p && (a.adler = c.check = c.flags ? t(c.check, f, p, h - p) : s(c.check, f, p, h - p)), p = j, (c.flags ? m : d(m)) !== c.check) {
                                            a.msg = "incorrect data check", c.mode = lb;
                                            break
                                        }
                                        m = 0, n = 0
                                    }
                                    c.mode = jb;
                                case jb:
                                    if (c.wrap && c.flags) {
                                        for (; 32 > n;) {
                                            if (0 === i) break a;
                                            i--, m += e[g++] << n, n += 8
                                        }
                                        if (m !== (4294967295 & c.total)) {
                                            a.msg = "incorrect length check", c.mode = lb;
                                            break
                                        }
                                        m = 0, n = 0
                                    }
                                    c.mode = kb;
                                case kb:
                                    xb = D;
                                    break a;
                                case lb:
                                    xb = G;
                                    break a;
                                case mb:
                                    return H;
                                case nb:
                                default:
                                    return F
                            }
                            return a.next_out = h, a.avail_out = j, a.next_in = g, a.avail_in = i, c.hold = m, c.bits = n, (c.wsize || p !== a.avail_out && c.mode < lb && (c.mode < ib || b !== z)) && l(a, a.output, a.next_out, p - a.avail_out) ? (c.mode = mb, H) : (o -= a.avail_in, p -= a.avail_out, a.total_in += o, a.total_out += p, c.total += p, c.wrap && p && (a.adler = c.check = c.flags ? t(c.check, f, p, a.next_out - p) : s(c.check, f, p, a.next_out - p)), a.data_type = c.bits + (c.last ? 64 : 0) + (c.mode === V ? 128 : 0) + (c.mode === bb || c.mode === Y ? 256 : 0), (0 === o && 0 === p || b === z) && xb === C && (xb = I), xb)
                        }

                        function n(a) {
                            if (!a || !a.state) return F;
                            var b = a.state;
                            return b.window && (b.window = null), a.state = null, C
                        }

                        function o(a, b) {
                            var c;
                            return a && a.state ? (c = a.state, 0 === (2 & c.wrap) ? F : (c.head = b, b.done = !1, C)) : F
                        }

                        var p, q, r = a("../utils/common"), s = a("./adler32"), t = a("./crc32"), u = a("./inffast"), v = a("./inftrees"), w = 0, x = 1, y = 2, z = 4, A = 5, B = 6, C = 0, D = 1, E = 2, F = -2, G = -3, H = -4, I = -5, J = 8, K = 1, L = 2, M = 3, N = 4, O = 5, P = 6, Q = 7, R = 8, S = 9, T = 10, U = 11, V = 12, W = 13, X = 14, Y = 15, Z = 16, $ = 17, _ = 18, ab = 19, bb = 20, cb = 21, db = 22, eb = 23, fb = 24, gb = 25, hb = 26, ib = 27, jb = 28, kb = 29, lb = 30, mb = 31, nb = 32, ob = 852,
                            pb = 592, qb = 15, rb = qb, sb = !0;
                        c.inflateReset = g, c.inflateReset2 = h, c.inflateResetKeep = f, c.inflateInit = j, c.inflateInit2 = i, c.inflate = m, c.inflateEnd = n, c.inflateGetHeader = o, c.inflateInfo = "pako inflate (from Nodeca project)"
                    }, {"../utils/common": 27, "./adler32": 29, "./crc32": 31, "./inffast": 34, "./inftrees": 36}], 36: [function (a, b) {
                        "use strict";
                        var c = a("../utils/common"), d = 15, e = 852, f = 592, g = 0, h = 1, i = 2, j = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], k = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], l = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0],
                            m = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
                        b.exports = function (a, b, n, o, p, q, r, s) {
                            var t, u, v, w, x, y, z, A, B, C = s.bits, D = 0, E = 0, F = 0, G = 0, H = 0, I = 0, J = 0, K = 0, L = 0, M = 0, N = null, O = 0, P = new c.Buf16(d + 1), Q = new c.Buf16(d + 1), R = null, S = 0;
                            for (D = 0; d >= D; D++) P[D] = 0;
                            for (E = 0; o > E; E++) P[b[n + E]]++;
                            for (H = C, G = d; G >= 1 && 0 === P[G]; G--) ;
                            if (H > G && (H = G), 0 === G) return p[q++] = 20971520, p[q++] = 20971520, s.bits = 1, 0;
                            for (F = 1; G > F && 0 === P[F]; F++) ;
                            for (F > H && (H = F), K = 1, D = 1; d >= D; D++) if (K <<= 1, K -= P[D], 0 > K) return -1;
                            if (K > 0 && (a === g || 1 !== G)) return -1;
                            for (Q[1] = 0, D = 1; d > D; D++) Q[D + 1] = Q[D] + P[D];
                            for (E = 0; o > E; E++) 0 !== b[n + E] && (r[Q[b[n + E]]++] = E);
                            if (a === g ? (N = R = r, y = 19) : a === h ? (N = j, O -= 257, R = k, S -= 257, y = 256) : (N = l, R = m, y = -1), M = 0, E = 0, D = F, x = q, I = H, J = 0, v = -1, L = 1 << H, w = L - 1, a === h && L > e || a === i && L > f) return 1;
                            for (var T = 0; ;) {
                                T++, z = D - J, r[E] < y ? (A = 0, B = r[E]) : r[E] > y ? (A = R[S + r[E]], B = N[O + r[E]]) : (A = 96, B = 0), t = 1 << D - J, u = 1 << I, F = u;
                                do u -= t, p[x + (M >> J) + u] = z << 24 | A << 16 | B | 0; while (0 !== u);
                                for (t = 1 << D - 1; M & t;) t >>= 1;
                                if (0 !== t ? (M &= t - 1, M += t) : M = 0, E++, 0 === --P[D]) {
                                    if (D === G) break;
                                    D = b[n + r[E]]
                                }
                                if (D > H && (M & w) !== v) {
                                    for (0 === J && (J = H), x += F, I = D - J, K = 1 << I; G > I + J && (K -= P[I + J], !(0 >= K));) I++, K <<= 1;
                                    if (L += 1 << I, a === h && L > e || a === i && L > f) return 1;
                                    v = M & w, p[v] = H << 24 | I << 16 | x - q | 0
                                }
                            }
                            return 0 !== M && (p[x + M] = D - J << 24 | 64 << 16 | 0), s.bits = H, 0
                        }
                    }, {"../utils/common": 27}], 37: [function (a, b) {
                        "use strict";
                        b.exports = {2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version"}
                    }, {}], 38: [function (a, b, c) {
                        "use strict";

                        function d(a) {
                            for (var b = a.length; --b >= 0;) a[b] = 0
                        }

                        function e(a) {
                            return 256 > a ? gb[a] : gb[256 + (a >>> 7)]
                        }

                        function f(a, b) {
                            a.pending_buf[a.pending++] = 255 & b, a.pending_buf[a.pending++] = b >>> 8 & 255
                        }

                        function g(a, b, c) {
                            a.bi_valid > V - c ? (a.bi_buf |= b << a.bi_valid & 65535, f(a, a.bi_buf), a.bi_buf = b >> V - a.bi_valid, a.bi_valid += c - V) : (a.bi_buf |= b << a.bi_valid & 65535, a.bi_valid += c)
                        }

                        function h(a, b, c) {
                            g(a, c[2 * b], c[2 * b + 1])
                        }

                        function i(a, b) {
                            var c = 0;
                            do c |= 1 & a, a >>>= 1, c <<= 1; while (--b > 0);
                            return c >>> 1
                        }

                        function j(a) {
                            16 === a.bi_valid ? (f(a, a.bi_buf), a.bi_buf = 0, a.bi_valid = 0) : a.bi_valid >= 8 && (a.pending_buf[a.pending++] = 255 & a.bi_buf, a.bi_buf >>= 8, a.bi_valid -= 8)
                        }

                        function k(a, b) {
                            var c, d, e, f, g, h, i = b.dyn_tree, j = b.max_code, k = b.stat_desc.static_tree, l = b.stat_desc.has_stree, m = b.stat_desc.extra_bits, n = b.stat_desc.extra_base, o = b.stat_desc.max_length, p = 0;
                            for (f = 0; U >= f; f++) a.bl_count[f] = 0;
                            for (i[2 * a.heap[a.heap_max] + 1] = 0, c = a.heap_max + 1; T > c; c++) d = a.heap[c], f = i[2 * i[2 * d + 1] + 1] + 1, f > o && (f = o, p++), i[2 * d + 1] = f, d > j || (a.bl_count[f]++, g = 0, d >= n && (g = m[d - n]), h = i[2 * d], a.opt_len += h * (f + g), l && (a.static_len += h * (k[2 * d + 1] + g)));
                            if (0 !== p) {
                                do {
                                    for (f = o - 1; 0 === a.bl_count[f];) f--;
                                    a.bl_count[f]--, a.bl_count[f + 1] += 2, a.bl_count[o]--, p -= 2
                                } while (p > 0);
                                for (f = o; 0 !== f; f--) for (d = a.bl_count[f]; 0 !== d;) e = a.heap[--c], e > j || (i[2 * e + 1] !== f && (a.opt_len += (f - i[2 * e + 1]) * i[2 * e], i[2 * e + 1] = f), d--)
                            }
                        }

                        function l(a, b, c) {
                            var d, e, f = new Array(U + 1), g = 0;
                            for (d = 1; U >= d; d++) f[d] = g = g + c[d - 1] << 1;
                            for (e = 0; b >= e; e++) {
                                var h = a[2 * e + 1];
                                0 !== h && (a[2 * e] = i(f[h]++, h))
                            }
                        }

                        function m() {
                            var a, b, c, d, e, f = new Array(U + 1);
                            for (c = 0, d = 0; O - 1 > d; d++) for (ib[d] = c, a = 0; a < 1 << _[d]; a++) hb[c++] = d;
                            for (hb[c - 1] = d, e = 0, d = 0; 16 > d; d++) for (jb[d] = e, a = 0; a < 1 << ab[d]; a++) gb[e++] = d;
                            for (e >>= 7; R > d; d++) for (jb[d] = e << 7, a = 0; a < 1 << ab[d] - 7; a++) gb[256 + e++] = d;
                            for (b = 0; U >= b; b++) f[b] = 0;
                            for (a = 0; 143 >= a;) eb[2 * a + 1] = 8, a++, f[8]++;
                            for (; 255 >= a;) eb[2 * a + 1] = 9, a++, f[9]++;
                            for (; 279 >= a;) eb[2 * a + 1] = 7, a++, f[7]++;
                            for (; 287 >= a;) eb[2 * a + 1] = 8, a++, f[8]++;
                            for (l(eb, Q + 1, f), a = 0; R > a; a++) fb[2 * a + 1] = 5, fb[2 * a] = i(a, 5);
                            kb = new nb(eb, _, P + 1, Q, U), lb = new nb(fb, ab, 0, R, U), mb = new nb(new Array(0), bb, 0, S, W)
                        }

                        function n(a) {
                            var b;
                            for (b = 0; Q > b; b++) a.dyn_ltree[2 * b] = 0;
                            for (b = 0; R > b; b++) a.dyn_dtree[2 * b] = 0;
                            for (b = 0; S > b; b++) a.bl_tree[2 * b] = 0;
                            a.dyn_ltree[2 * X] = 1, a.opt_len = a.static_len = 0, a.last_lit = a.matches = 0
                        }

                        function o(a) {
                            a.bi_valid > 8 ? f(a, a.bi_buf) : a.bi_valid > 0 && (a.pending_buf[a.pending++] = a.bi_buf), a.bi_buf = 0, a.bi_valid = 0
                        }

                        function p(a, b, c, d) {
                            o(a), d && (f(a, c), f(a, ~c)), E.arraySet(a.pending_buf, a.window, b, c, a.pending), a.pending += c
                        }

                        function q(a, b, c, d) {
                            var e = 2 * b, f = 2 * c;
                            return a[e] < a[f] || a[e] === a[f] && d[b] <= d[c]
                        }

                        function r(a, b, c) {
                            for (var d = a.heap[c], e = c << 1; e <= a.heap_len && (e < a.heap_len && q(b, a.heap[e + 1], a.heap[e], a.depth) && e++, !q(b, d, a.heap[e], a.depth));) a.heap[c] = a.heap[e], c = e, e <<= 1;
                            a.heap[c] = d
                        }

                        function s(a, b, c) {
                            var d, f, i, j, k = 0;
                            if (0 !== a.last_lit) do d = a.pending_buf[a.d_buf + 2 * k] << 8 | a.pending_buf[a.d_buf + 2 * k + 1], f = a.pending_buf[a.l_buf + k], k++, 0 === d ? h(a, f, b) : (i = hb[f], h(a, i + P + 1, b), j = _[i], 0 !== j && (f -= ib[i], g(a, f, j)), d--, i = e(d), h(a, i, c), j = ab[i], 0 !== j && (d -= jb[i], g(a, d, j))); while (k < a.last_lit);
                            h(a, X, b)
                        }

                        function t(a, b) {
                            var c, d, e, f = b.dyn_tree, g = b.stat_desc.static_tree, h = b.stat_desc.has_stree, i = b.stat_desc.elems, j = -1;
                            for (a.heap_len = 0, a.heap_max = T, c = 0; i > c; c++) 0 !== f[2 * c] ? (a.heap[++a.heap_len] = j = c, a.depth[c] = 0) : f[2 * c + 1] = 0;
                            for (; a.heap_len < 2;) e = a.heap[++a.heap_len] = 2 > j ? ++j : 0, f[2 * e] = 1, a.depth[e] = 0, a.opt_len--, h && (a.static_len -= g[2 * e + 1]);
                            for (b.max_code = j, c = a.heap_len >> 1; c >= 1; c--) r(a, f, c);
                            e = i;
                            do c = a.heap[1], a.heap[1] = a.heap[a.heap_len--], r(a, f, 1), d = a.heap[1], a.heap[--a.heap_max] = c, a.heap[--a.heap_max] = d, f[2 * e] = f[2 * c] + f[2 * d], a.depth[e] = (a.depth[c] >= a.depth[d] ? a.depth[c] : a.depth[d]) + 1, f[2 * c + 1] = f[2 * d + 1] = e, a.heap[1] = e++, r(a, f, 1); while (a.heap_len >= 2);
                            a.heap[--a.heap_max] = a.heap[1], k(a, b), l(f, j, a.bl_count)
                        }

                        function u(a, b, c) {
                            var d, e, f = -1, g = b[1], h = 0, i = 7, j = 4;
                            for (0 === g && (i = 138, j = 3), b[2 * (c + 1) + 1] = 65535, d = 0; c >= d; d++) e = g, g = b[2 * (d + 1) + 1], ++h < i && e === g || (j > h ? a.bl_tree[2 * e] += h : 0 !== e ? (e !== f && a.bl_tree[2 * e]++, a.bl_tree[2 * Y]++) : 10 >= h ? a.bl_tree[2 * Z]++ : a.bl_tree[2 * $]++, h = 0, f = e, 0 === g ? (i = 138, j = 3) : e === g ? (i = 6, j = 3) : (i = 7, j = 4))
                        }

                        function v(a, b, c) {
                            var d, e, f = -1, i = b[1], j = 0, k = 7, l = 4;
                            for (0 === i && (k = 138, l = 3), d = 0; c >= d; d++) if (e = i, i = b[2 * (d + 1) + 1], !(++j < k && e === i)) {
                                if (l > j) {
                                    do h(a, e, a.bl_tree); while (0 !== --j)
                                } else 0 !== e ? (e !== f && (h(a, e, a.bl_tree), j--), h(a, Y, a.bl_tree), g(a, j - 3, 2)) : 10 >= j ? (h(a, Z, a.bl_tree), g(a, j - 3, 3)) : (h(a, $, a.bl_tree), g(a, j - 11, 7));
                                j = 0, f = e, 0 === i ? (k = 138, l = 3) : e === i ? (k = 6, l = 3) : (k = 7, l = 4)
                            }
                        }

                        function w(a) {
                            var b;
                            for (u(a, a.dyn_ltree, a.l_desc.max_code), u(a, a.dyn_dtree, a.d_desc.max_code), t(a, a.bl_desc), b = S - 1; b >= 3 && 0 === a.bl_tree[2 * cb[b] + 1]; b--) ;
                            return a.opt_len += 3 * (b + 1) + 5 + 5 + 4, b
                        }

                        function x(a, b, c, d) {
                            var e;
                            for (g(a, b - 257, 5), g(a, c - 1, 5), g(a, d - 4, 4), e = 0; d > e; e++) g(a, a.bl_tree[2 * cb[e] + 1], 3);
                            v(a, a.dyn_ltree, b - 1), v(a, a.dyn_dtree, c - 1)
                        }

                        function y(a) {
                            var b, c = 4093624447;
                            for (b = 0; 31 >= b; b++, c >>>= 1) if (1 & c && 0 !== a.dyn_ltree[2 * b]) return G;
                            if (0 !== a.dyn_ltree[18] || 0 !== a.dyn_ltree[20] || 0 !== a.dyn_ltree[26]) return H;
                            for (b = 32; P > b; b++) if (0 !== a.dyn_ltree[2 * b]) return H;
                            return G
                        }

                        function z(a) {
                            pb || (m(), pb = !0), a.l_desc = new ob(a.dyn_ltree, kb), a.d_desc = new ob(a.dyn_dtree, lb), a.bl_desc = new ob(a.bl_tree, mb), a.bi_buf = 0, a.bi_valid = 0, n(a)
                        }

                        function A(a, b, c, d) {
                            g(a, (J << 1) + (d ? 1 : 0), 3), p(a, b, c, !0)
                        }

                        function B(a) {
                            g(a, K << 1, 3), h(a, X, eb), j(a)
                        }

                        function C(a, b, c, d) {
                            var e, f, h = 0;
                            a.level > 0 ? (a.strm.data_type === I && (a.strm.data_type = y(a)), t(a, a.l_desc), t(a, a.d_desc), h = w(a), e = a.opt_len + 3 + 7 >>> 3, f = a.static_len + 3 + 7 >>> 3, e >= f && (e = f)) : e = f = c + 5, e >= c + 4 && -1 !== b ? A(a, b, c, d) : a.strategy === F || f === e ? (g(a, (K << 1) + (d ? 1 : 0), 3), s(a, eb, fb)) : (g(a, (L << 1) + (d ? 1 : 0), 3), x(a, a.l_desc.max_code + 1, a.d_desc.max_code + 1, h + 1), s(a, a.dyn_ltree, a.dyn_dtree)), n(a), d && o(a)
                        }

                        function D(a, b, c) {
                            return a.pending_buf[a.d_buf + 2 * a.last_lit] = b >>> 8 & 255, a.pending_buf[a.d_buf + 2 * a.last_lit + 1] = 255 & b, a.pending_buf[a.l_buf + a.last_lit] = 255 & c, a.last_lit++, 0 === b ? a.dyn_ltree[2 * c]++ : (a.matches++, b--, a.dyn_ltree[2 * (hb[c] + P + 1)]++, a.dyn_dtree[2 * e(b)]++), a.last_lit === a.lit_bufsize - 1
                        }

                        var E = a("../utils/common"), F = 4, G = 0, H = 1, I = 2, J = 0, K = 1, L = 2, M = 3, N = 258, O = 29, P = 256, Q = P + 1 + O, R = 30, S = 19, T = 2 * Q + 1, U = 15, V = 16, W = 7, X = 256, Y = 16, Z = 17, $ = 18, _ = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], ab = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], bb = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7],
                            cb = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], db = 512, eb = new Array(2 * (Q + 2));
                        d(eb);
                        var fb = new Array(2 * R);
                        d(fb);
                        var gb = new Array(db);
                        d(gb);
                        var hb = new Array(N - M + 1);
                        d(hb);
                        var ib = new Array(O);
                        d(ib);
                        var jb = new Array(R);
                        d(jb);
                        var kb, lb, mb, nb = function (a, b, c, d, e) {
                            this.static_tree = a, this.extra_bits = b, this.extra_base = c, this.elems = d, this.max_length = e, this.has_stree = a && a.length
                        }, ob = function (a, b) {
                            this.dyn_tree = a, this.max_code = 0, this.stat_desc = b
                        }, pb = !1;
                        c._tr_init = z, c._tr_stored_block = A, c._tr_flush_block = C, c._tr_tally = D, c._tr_align = B
                    }, {"../utils/common": 27}], 39: [function (a, b) {
                        "use strict";

                        function c() {
                            this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0
                        }

                        b.exports = c
                    }, {}]
                }, {}, [9])(9)
            });
        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}, require("buffer").Buffer)
    }, {"buffer": 1}], 27: [function (require, module, exports) {
        var size = function (str, charset) {
            var total = 0,
                charCode,
                i,
                len;
            charset = charset ? charset.toLowerCase() : '';
            if (charset === 'utf-16' || charset === 'utf16') {
                for (i = 0, len = str.length; i < len; i++) {
                    charCode = str.charCodeAt(i);
                    if (charCode <= 0xffff) {
                        total += 2;
                    } else {
                        total += 4;
                    }
                }
            } else {
                for (i = 0, len = str.length; i < len; i++) {
                    charCode = str.charCodeAt(i);
                    if (charCode <= 0x007f) {
                        total += 1;
                    } else if (charCode <= 0x07ff) {
                        total += 2;
                    } else if (charCode <= 0xffff) {
                        total += 3;
                    } else {
                        total += 4;
                    }
                }
            }
            return total;
        };

        module.exports = size;
    }, {}]
}, {}, [22]);
