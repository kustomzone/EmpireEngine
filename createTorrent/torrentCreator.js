"use strict";
var fs = require("fs");
var bencode = require('bencode');
function createTorrent(torrentFile) {
}
var bencode = require('bencode');
var BlockStream = require('block-stream2');
var calcPieceLength = require('piece-length');
var corePath = require('path');
var extend = require('xtend');
var FileReadStream = require('filestream/read');
var flatten = require('flatten');
var fs = require('fs');
var isFile = require('is-file');
var junk = require('junk');
var MultiStream = require('multistream');
var once = require('once');
var parallel = require('run-parallel');
var sha1 = require('simple-sha1');
var stream = require('readable-stream');
function createTorrent(input, opts, cb) {
    if (typeof opts === 'function')
        return createTorrent(input, null, opts);
    opts = opts ? extend(opts) : {};
    _parseInput(input, opts, function (err, files, singleFileTorrent) {
        if (err)
            return cb(err);
        opts.singleFileTorrent = singleFileTorrent;
        onFiles(files, opts, cb);
    });
}
function parseInput(input, opts, cb) {
    if (typeof opts === 'function')
        return parseInput(input, null, opts);
    opts = opts ? extend(opts) : {};
    _parseInput(input, opts, cb);
}
function _parseInput(input, opts, cb) {
    if (Array.isArray(input) && input.length === 0)
        throw new Error('invalid input type');
    if (isFileList(input))
        input = Array.prototype.slice.call(input);
    if (!Array.isArray(input))
        input = [input];
    input = input.map(function (item) {
        if (isBlob(item) && typeof item.path === 'string' && typeof fs.stat === 'function')
            return item.path;
        return item;
    });
    if (input.length === 1 && typeof input[0] !== 'string' && !input[0].name)
        input[0].name = opts.name;
    var commonPrefix = null;
    input.forEach(function (item, i) {
        if (typeof item === 'string') {
            return;
        }
        var path = item.fullPath || item.name;
        if (!path) {
            path = 'Unknown File ' + (i + 1);
            item.unknownName = true;
        }
        item.path = path.split('/');
        if (!item.path[0]) {
            item.path.shift();
        }
        if (item.path.length < 2) {
            commonPrefix = null;
        }
        else if (i === 0 && input.length > 1) {
            commonPrefix = item.path[0];
        }
        else if (item.path[0] !== commonPrefix) {
            commonPrefix = null;
        }
    });
    input = input.filter(function (item) {
        if (typeof item === 'string') {
            return true;
        }
        var filename = item.path[item.path.length - 1];
        return notHidden(filename) && junk.not(filename);
    });
    if (commonPrefix) {
        input.forEach(function (item) {
            var pathless = (Buffer.isBuffer(item) || isReadable(item)) && !item.path;
            if (typeof item === 'string' || pathless)
                return;
            item.path.shift();
        });
    }
    if (!opts.name && commonPrefix) {
        opts.name = commonPrefix;
    }
    if (!opts.name) {
        input.some(function (item) {
            if (typeof item === 'string') {
                opts.name = corePath.basename(item);
                return true;
            }
            else if (!item.unknownName) {
                opts.name = item.path[item.path.length - 1];
                return true;
            }
        });
    }
    if (!opts.name) {
        opts.name = 'Unnamed Torrent ' + Date.now();
    }
    var numPaths = input.reduce(function (sum, item) {
        return sum + Number(typeof item === 'string');
    }, 0);
    var isSingleFileTorrent = (input.length === 1);
    if (input.length === 1 && typeof input[0] === 'string') {
        if (typeof fs.stat !== 'function') {
            throw new Error('filesystem paths do not work in the browser');
        }
        isFile(input[0], function (err, pathIsFile) {
            if (err)
                return cb(err);
            isSingleFileTorrent = pathIsFile;
            processInput();
        });
    }
    else {
        process.nextTick(function () {
            processInput();
        });
    }
    function processInput() {
        parallel(input.map(function (item) {
            return function (cb) {
                var file = {};
                if (isBlob(item)) {
                    file.getStream = getBlobStream(item);
                    file.length = item.size;
                }
                else if (Buffer.isBuffer(item)) {
                    file.getStream = getBufferStream(item);
                    file.length = item.length;
                }
                else if (isReadable(item)) {
                    file.getStream = getStreamStream(item, file);
                    file.length = 0;
                }
                else if (typeof item === 'string') {
                    if (typeof fs.stat !== 'function') {
                        throw new Error('filesystem paths do not work in the browser');
                    }
                    var keepRoot = numPaths > 1 || isSingleFileTorrent;
                    getFiles(item, keepRoot, cb);
                    return;
                }
                else {
                    throw new Error('invalid input type');
                }
                file.path = item.path;
                cb(null, file);
            };
        }), function (err, files) {
            if (err)
                return cb(err);
            files = flatten(files);
            cb(null, files, isSingleFileTorrent);
        });
    }
}
function getFiles(path, keepRoot, cb) {
    traversePath(path, getFileInfo, function (err, files) {
        if (err)
            return cb(err);
        if (Array.isArray(files))
            files = flatten(files);
        else
            files = [files];
        path = corePath.normalize(path);
        if (keepRoot) {
            path = path.slice(0, path.lastIndexOf(corePath.sep) + 1);
        }
        if (path[path.length - 1] !== corePath.sep)
            path += corePath.sep;
        files.forEach(function (file) {
            file.getStream = getFilePathStream(file.path);
            file.path = file.path.replace(path, '').split(corePath.sep);
        });
        cb(null, files);
    });
}
function getFileInfo(path, cb) {
    cb = once(cb);
    fs.stat(path, function (err, stat) {
        if (err)
            return cb(err);
        var info = {
            length: stat.size,
            path: path
        };
        cb(null, info);
    });
}
function traversePath(path, fn, cb) {
    fs.readdir(path, function (err, entries) {
        if (err && err.code === 'ENOTDIR') {
            fn(path, cb);
        }
        else if (err) {
            cb(err);
        }
        else {
            parallel(entries.filter(notHidden).filter(junk.not).map(function (entry) {
                return function (cb) {
                    traversePath(corePath.join(path, entry), fn, cb);
                };
            }), cb);
        }
    });
}
function notHidden(file) {
    return file[0] !== '.';
}
function getPieceList(files, pieceLength, cb) {
    cb = once(cb);
    var pieces = [];
    var length = 0;
    var streams = files.map(function (file) {
        return file.getStream;
    });
    var remainingHashes = 0;
    var pieceNum = 0;
    var ended = false;
    var multistream = new MultiStream(streams);
    var blockstream = new BlockStream(pieceLength, { zeroPadding: false });
    multistream.on('error', onError);
    multistream
        .pipe(blockstream)
        .on('data', onData)
        .on('end', onEnd)
        .on('error', onError);
    function onData(chunk) {
        length += chunk.length;
        var i = pieceNum;
        sha1(chunk, function (hash) {
            pieces[i] = hash;
            remainingHashes -= 1;
            maybeDone();
        });
        remainingHashes += 1;
        pieceNum += 1;
    }
    function onEnd() {
        ended = true;
        maybeDone();
    }
    function onError(err) {
        cleanup();
        cb(err);
    }
    function cleanup() {
        multistream.removeListener('error', onError);
        blockstream.removeListener('data', onData);
        blockstream.removeListener('end', onEnd);
        blockstream.removeListener('error', onError);
    }
    function maybeDone() {
        if (ended && remainingHashes === 0) {
            cleanup();
            cb(null, new Buffer(pieces.join(''), 'hex'), length);
        }
    }
}
function onFiles(files, opts, cb) {
    var announceList = opts.announceList;
    if (!announceList) {
        if (typeof opts.announce === 'string')
            announceList = [[opts.announce]];
        else if (Array.isArray(opts.announce)) {
            announceList = opts.announce.map(function (u) { return [u]; });
        }
    }
    if (!announceList)
        announceList = [];
    if (global.WEBTORRENT_ANNOUNCE) {
        if (typeof global.WEBTORRENT_ANNOUNCE === 'string') {
            announceList.push([[global.WEBTORRENT_ANNOUNCE]]);
        }
        else if (Array.isArray(global.WEBTORRENT_ANNOUNCE)) {
            announceList = announceList.concat(global.WEBTORRENT_ANNOUNCE.map(function (u) {
                return [u];
            }));
        }
    }
    if (opts.announce === undefined && opts.announceList === undefined) {
        announceList = announceList.concat(module.exports.announceList);
    }
    if (typeof opts.urlList === 'string')
        opts.urlList = [opts.urlList];
    var torrent = {
        info: {
            name: opts.name
        },
        'creation date': Math.ceil((Number(opts.creationDate) || Date.now()) / 1000),
        encoding: 'UTF-8'
    };
    if (announceList.length !== 0) {
        torrent.announce = announceList[0][0];
        torrent['announce-list'] = announceList;
    }
    if (opts.comment !== undefined)
        torrent.comment = opts.comment;
    if (opts.createdBy !== undefined)
        torrent['created by'] = opts.createdBy;
    if (opts.private !== undefined)
        torrent.info.private = Number(opts.private);
    if (opts.sslCert !== undefined)
        torrent.info['ssl-cert'] = opts.sslCert;
    if (opts.urlList !== undefined)
        torrent['url-list'] = opts.urlList;
    var pieceLength = opts.pieceLength || calcPieceLength(files.reduce(sumLength, 0));
    torrent.info['piece length'] = pieceLength;
    getPieceList(files, pieceLength, function (err, pieces, torrentLength) {
        if (err)
            return cb(err);
        torrent.info.pieces = pieces;
        files.forEach(function (file) {
            delete file.getStream;
        });
        if (opts.singleFileTorrent) {
            torrent.info.length = torrentLength;
        }
        else {
            torrent.info.files = files;
        }
        cb(null, bencode.encode(torrent));
    });
}
function sumLength(sum, file) {
    return sum + file.length;
}
function isBlob(obj) {
    return typeof Blob !== 'undefined' && obj instanceof Blob;
}
function isFileList(obj) {
    return typeof FileList !== 'undefined' && obj instanceof FileList;
}
function isReadable(obj) {
    return typeof obj === 'object' && obj != null && typeof obj.pipe === 'function';
}
function getBlobStream(file) {
    return function () {
        return new FileReadStream(file);
    };
}
function getBufferStream(buffer) {
    return function () {
        var s = new stream.PassThrough();
        s.end(buffer);
        return s;
    };
}
function getFilePathStream(path) {
    return function () {
        return fs.createReadStream(path);
    };
}
function getStreamStream(readable, file) {
    return function () {
        var counter = new stream.Transform();
        counter._transform = function (buf, enc, done) {
            file.length += buf.length;
            this.push(buf);
            done();
        };
        readable.pipe(counter);
        return counter;
    };
}
