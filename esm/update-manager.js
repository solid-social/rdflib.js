import _typeof from "@babel/runtime/helpers/typeof";
import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _classCallCheck from "@babel/runtime/helpers/classCallCheck";
import _createClass from "@babel/runtime/helpers/createClass";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _regeneratorRuntime from "@babel/runtime/regenerator";
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
/* @file Update Manager Class
**
** 2007-07-15 originall sparl update module by Joe Presbrey <presbrey@mit.edu>
** 2010-08-08 TimBL folded in Kenny's WEBDAV
** 2010-12-07 TimBL addred local file write code
*/
import IndexedFormula from './store';
import { docpart, join as uriJoin } from './uri';
import Fetcher from './fetcher';
import Namespace from './namespace';
import Serializer from './serializer';
import { isBlankNode, isStore } from './utils/terms';
import * as Util from './utils-js';
import { termValue } from './utils/termValue';
/**
* The UpdateManager is a helper object for a store.
* Just as a Fetcher provides the store with the ability to read and write,
* the Update Manager provides functionality for making small patches in real time,
* and also looking out for concurrent updates from other agents
*/
var UpdateManager = /*#__PURE__*/function () {
  /** Index of objects for coordinating incoming and outgoing patches */

  /** Object of namespaces */

  /**
   * @param  store - The quadstore to store data and metadata. Created if not passed.
  */
  function UpdateManager(store) {
    _classCallCheck(this, UpdateManager);
    _defineProperty(this, "store", void 0);
    _defineProperty(this, "ifps", void 0);
    _defineProperty(this, "fps", void 0);
    _defineProperty(this, "patchControl", void 0);
    _defineProperty(this, "ns", void 0);
    store = store || new IndexedFormula();
    if (store.updater) {
      throw new Error("You can't have two UpdateManagers for the same store");
    }
    if (!store.fetcher) {
      store.fetcher = new Fetcher(store);
    }
    this.store = store;
    store.updater = this;
    this.ifps = {};
    this.fps = {};
    this.ns = {};
    this.ns.link = Namespace('http://www.w3.org/2007/ont/link#');
    this.ns.http = Namespace('http://www.w3.org/2007/ont/http#');
    this.ns.httph = Namespace('http://www.w3.org/2007/ont/httph#');
    this.ns.ldp = Namespace('http://www.w3.org/ns/ldp#');
    this.ns.rdf = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    this.ns.rdfs = Namespace('http://www.w3.org/2000/01/rdf-schema#');
    this.ns.rdf = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    this.ns.owl = Namespace('http://www.w3.org/2002/07/owl#');
    this.patchControl = [];
  }
  _createClass(UpdateManager, [{
    key: "patchControlFor",
    value: function patchControlFor(doc) {
      if (!this.patchControl[doc.value]) {
        this.patchControl[doc.value] = [];
      }
      return this.patchControl[doc.value];
    }
  }, {
    key: "isHttpUri",
    value: function isHttpUri(uri) {
      return uri.slice(0, 4) === 'http';
    }

    /** Remove from the store HTTP authorization metadata
    * The editble function below relies on copies we have in the store
    * of the results of previous HTTP transactions. Howver, when
    * the user logs in, then that data misrepresents what would happen
    * if the user tried again.
    */
  }, {
    key: "flagAuthorizationMetadata",
    value: function flagAuthorizationMetadata(kb) {
      var _kb$fetcher;
      if (!kb) {
        kb = this.store;
      }
      var meta = (_kb$fetcher = kb.fetcher) === null || _kb$fetcher === void 0 ? void 0 : _kb$fetcher.appNode;
      var requests = kb.statementsMatching(undefined, this.ns.link('requestedURI'), undefined, meta).map(function (st) {
        return st.subject;
      });
      var _iterator = _createForOfIteratorHelper(requests),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var request = _step.value;
          var _response = kb.any(request, this.ns.link('response'), null, meta);
          if (_response !== undefined) {
            // ts
            kb.add(_response, this.ns.link('outOfDate'), true, meta); // @@ Boolean is fine - fix types
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    /**
     * Tests whether a file is editable.
     * If the file has a specific annotation that it is machine written,
     * for safety, it is editable (this doesn't actually check for write access)
     * If the file has wac-allow and accept patch headers, those are respected.
     * and local write access is determined by those headers.
     * This async version not only looks at past HTTP requests, it also makes new ones if necessary.
     *
     * @returns The method string SPARQL or DAV or
     *   LOCALFILE or false if known, undefined if not known.
     */
  }, {
    key: "checkEditable",
    value: function () {
      var _checkEditable = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(uri, kb) {
        var _kb$fetcher2;
        var initial, final;
        return _regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              if (uri) {
                _context.next = 2;
                break;
              }
              return _context.abrupt("return", false);
            case 2:
              if (!kb) {
                kb = this.store;
              }
              initial = this.editable(uri, kb);
              if (!(initial !== undefined)) {
                _context.next = 6;
                break;
              }
              return _context.abrupt("return", initial);
            case 6:
              _context.next = 8;
              return (_kb$fetcher2 = kb.fetcher) === null || _kb$fetcher2 === void 0 ? void 0 : _kb$fetcher2.load(uri);
            case 8:
              final = this.editable(uri, kb); // console.log(`Loaded ${uri} just to check editable, result: ${final}.`)
              return _context.abrupt("return", final);
            case 10:
            case "end":
              return _context.stop();
          }
        }, _callee, this);
      }));
      function checkEditable(_x, _x2) {
        return _checkEditable.apply(this, arguments);
      }
      return checkEditable;
    }()
    /**
     * Tests whether a file is editable.
     * If the file has a specific annotation that it is machine written,
     * for safety, it is editable (this doesn't actually check for write access)
     * If the file has wac-allow and accept patch headers, those are respected.
     * and local write access is determined by those headers.
     * This synchronous version only looks at past HTTP requests, does not make new ones.
     *
     * @returns The method string SPARQL or DAV or
     *   LOCALFILE or false if known, undefined if not known.
     */
  }, {
    key: "editable",
    value: function editable(uri, kb) {
      var _kb$fetcher3;
      if (!uri) {
        return false; // Eg subject is bnode, no known doc to write to
      }

      if (!kb) {
        kb = this.store;
      }
      uri = termValue(uri);
      if (!this.isHttpUri(uri)) {
        if (kb.holds(kb.rdfFactory.namedNode(uri), kb.rdfFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), kb.rdfFactory.namedNode('http://www.w3.org/2007/ont/link#MachineEditableDocument'))) {
          return 'LOCALFILE';
        }
      }
      var request;
      var definitive = false;
      var meta = (_kb$fetcher3 = kb.fetcher) === null || _kb$fetcher3 === void 0 ? void 0 : _kb$fetcher3.appNode;
      // const kb = s

      // @ts-ignore passes a string to kb.each, which expects a term. Should this work?
      var requests = kb.each(undefined, this.ns.link('requestedURI'), docpart(uri), meta);
      var method;
      for (var r = 0; r < requests.length; r++) {
        request = requests[r];
        if (request !== undefined) {
          var _response2 = kb.any(request, this.ns.link('response'), null, meta);
          if (_response2 !== undefined) {
            // ts

            var outOfDate = kb.anyJS(_response2, this.ns.link('outOfDate'), null, meta);
            if (outOfDate) continue;
            var wacAllow = kb.anyValue(_response2, this.ns.httph('wac-allow'));
            if (wacAllow) {
              var _iterator2 = _createForOfIteratorHelper(wacAllow.split(',')),
                _step2;
              try {
                for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                  var bit = _step2.value;
                  var lr = bit.split('=');
                  if (lr[0].includes('user') && !lr[1].includes('write') && !lr[1].includes('append')) {
                    // console.log('    editable? excluded by WAC-Allow: ', wacAllow)
                    return false;
                  }
                }
              } catch (err) {
                _iterator2.e(err);
              } finally {
                _iterator2.f();
              }
            }
            var acceptPatch = kb.each(_response2, this.ns.httph('accept-patch'));
            if (acceptPatch.length) {
              for (var i = 0; i < acceptPatch.length; i++) {
                method = acceptPatch[i].value.trim();
                if (method.indexOf('application/sparql-update') >= 0) return 'SPARQL';
                if (method.indexOf('application/sparql-update-single-match') >= 0) return 'SPARQL';
              }
            }
            var authorVia = kb.each(_response2, this.ns.httph('ms-author-via'));
            if (authorVia.length) {
              for (var _i = 0; _i < authorVia.length; _i++) {
                method = authorVia[_i].value.trim();
                if (method.indexOf('SPARQL') >= 0) {
                  return 'SPARQL';
                }
                if (method.indexOf('DAV') >= 0) {
                  return 'DAV';
                }
              }
            }
            if (!this.isHttpUri(uri)) {
              if (!wacAllow) return false;else return 'LOCALFILE';
            }
            var status = kb.each(_response2, this.ns.http('status'));
            if (status.length) {
              for (var _i2 = 0; _i2 < status.length; _i2++) {
                // @ts-ignore since statuses should be TFTerms, this should always be false
                if (status[_i2] === 200 || status[_i2] === 404) {
                  definitive = true;
                  // return false // A definitive answer
                }
              }
            }
          } else {
            // console.log('UpdateManager.editable: No response for ' + uri + '\n')
          }
        }
      }
      if (requests.length === 0) {
        // console.log('UpdateManager.editable: No request for ' + uri + '\n')
      } else {
        if (definitive) {
          return false; // We have got a request and it did NOT say editable => not editable
        }
      }
      // console.log('UpdateManager.editable: inconclusive for ' + uri + '\n')
      return undefined; // We don't know (yet) as we haven't had a response (yet)
    }
  }, {
    key: "anonymize",
    value: function anonymize(obj) {
      return obj.toNT().substr(0, 2) === '_:' && this.mentioned(obj) ? '?' + obj.toNT().substr(2) : obj.toNT();
    }
  }, {
    key: "anonymizeNT",
    value: function anonymizeNT(stmt) {
      return this.anonymize(stmt.subject) + ' ' + this.anonymize(stmt.predicate) + ' ' + this.anonymize(stmt.object) + ' .';
    }
  }, {
    key: "nTriples",
    value: function nTriples(stmt) {
      return "".concat(stmt.subject.toNT(), " ").concat(stmt.predicate.toNT(), " ").concat(stmt.object.toNT(), " .");
    }

    /**
     * Returns a list of all bnodes occurring in a statement
     * @private
     */
  }, {
    key: "statementBnodes",
    value: function statementBnodes(st) {
      return [st.subject, st.predicate, st.object].filter(function (x) {
        return isBlankNode(x);
      });
    }

    /**
     * Returns a list of all bnodes occurring in a list of statements
     * @private
     */
  }, {
    key: "statementArrayBnodes",
    value: function statementArrayBnodes(sts) {
      var bnodes = [];
      for (var i = 0; i < sts.length; i++) {
        bnodes = bnodes.concat(this.statementBnodes(sts[i]));
      }
      bnodes.sort(); // in place sort - result may have duplicates
      var bnodes2 = [];
      for (var j = 0; j < bnodes.length; j++) {
        if (j === 0 || !bnodes[j].equals(bnodes[j - 1])) {
          bnodes2.push(bnodes[j]);
        }
      }
      return bnodes2;
    }

    /**
     * Makes a cached list of [Inverse-]Functional properties
     * @private
     */
  }, {
    key: "cacheIfps",
    value: function cacheIfps() {
      this.ifps = {};
      var a = this.store.each(undefined, this.ns.rdf('type'), this.ns.owl('InverseFunctionalProperty'));
      for (var i = 0; i < a.length; i++) {
        this.ifps[a[i].value] = true;
      }
      this.fps = {};
      a = this.store.each(undefined, this.ns.rdf('type'), this.ns.owl('FunctionalProperty'));
      for (var _i3 = 0; _i3 < a.length; _i3++) {
        this.fps[a[_i3].value] = true;
      }
    }

    /**
     * Returns a context to bind a given node, up to a given depth
     * @private
     */
  }, {
    key: "bnodeContext2",
    value: function bnodeContext2(x, source, depth) {
      // Return a list of statements which indirectly identify a node
      //  Depth > 1 if try further indirection.
      //  Return array of statements (possibly empty), or null if failure
      var sts = this.store.statementsMatching(undefined, undefined, x, source); // incoming links
      var y;
      var res;
      for (var i = 0; i < sts.length; i++) {
        if (this.fps[sts[i].predicate.value]) {
          y = sts[i].subject;
          if (!y.isBlank) {
            return [sts[i]];
          }
          if (depth) {
            res = this.bnodeContext2(y, source, depth - 1);
            if (res) {
              return res.concat([sts[i]]);
            }
          }
        }
      }
      // outgoing links
      sts = this.store.statementsMatching(x, undefined, undefined, source);
      for (var _i4 = 0; _i4 < sts.length; _i4++) {
        if (this.ifps[sts[_i4].predicate.value]) {
          y = sts[_i4].object;
          if (!y.isBlank) {
            return [sts[_i4]];
          }
          if (depth) {
            res = this.bnodeContext2(y, source, depth - 1);
            if (res) {
              return res.concat([sts[_i4]]);
            }
          }
        }
      }
      return null; // Failure
    }

    /**
     * Returns the smallest context to bind a given single bnode
     * @private
     */
  }, {
    key: "bnodeContext1",
    value: function bnodeContext1(x, source) {
      // Return a list of statements which indirectly identify a node
      //   Breadth-first
      for (var depth = 0; depth < 3; depth++) {
        // Try simple first
        var con = this.bnodeContext2(x, source, depth);
        if (con !== null) return con;
      }
      // If we can't guarantee unique with logic just send all info about node
      return this.store.connectedStatements(x, source); // was:
      // throw new Error('Unable to uniquely identify bnode: ' + x.toNT())
    }

    /**
     * @private
     */
  }, {
    key: "mentioned",
    value: function mentioned(x) {
      return this.store.statementsMatching(x, null, null, null).length !== 0 ||
      // Don't pin fresh bnodes
      this.store.statementsMatching(null, x).length !== 0 || this.store.statementsMatching(null, null, x).length !== 0;
    }

    /**
     * @private
     */
  }, {
    key: "bnodeContext",
    value: function bnodeContext(bnodes, doc) {
      var context = [];
      if (bnodes.length) {
        this.cacheIfps();
        for (var i = 0; i < bnodes.length; i++) {
          // Does this occur in old graph?
          var bnode = bnodes[i];
          if (!this.mentioned(bnode)) continue;
          context = context.concat(this.bnodeContext1(bnode, doc));
        }
      }
      return context;
    }

    /**
     * Returns the best context for a single statement
     * @private
     */
  }, {
    key: "statementContext",
    value: function statementContext(st) {
      var bnodes = this.statementBnodes(st);
      return this.bnodeContext(bnodes, st.graph);
    }

    /**
     * @private
     */
  }, {
    key: "contextWhere",
    value: function contextWhere(context) {
      var updater = this;
      return !context || context.length === 0 ? '' : 'WHERE { ' + context.map(function (x) {
        return updater.anonymizeNT(x);
      }).join('\n') + ' }\n';
    }

    /**
     * @private
     */
  }, {
    key: "fire",
    value: function fire(uri, query, callbackFunction) {
      var _this = this;
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      return Promise.resolve().then(function () {
        if (!uri) {
          throw new Error('No URI given for remote editing operation: ' + query);
        }
        // console.log('UpdateManager: sending update to <' + uri + '>')

        options.noMeta = true;
        options.contentType = 'application/sparql-update';
        options.body = query;
        return _this.store.fetcher.webOperation('PATCH', uri, options);
      }).then(function (response) {
        if (!response.ok) {
          var _message = 'UpdateManager: update failed for <' + uri + '> status=' + response.status + ', ' + response.statusText + '\n   for query: ' + query;
          // console.log(message)
          throw new Error(_message);
        }

        // console.log('UpdateManager: update Ok for <' + uri + '>')

        callbackFunction(uri, response.ok, response.responseText, response);
      }).catch(function (err) {
        callbackFunction(uri, false, err.message, err);
      });
    }

    // ARE THESE THEE FUNCTIONS USED? DEPROCATE?

    /** return a statemnet updating function
     *
     * This does NOT update the statement.
     * It returns an object which includes
     *  function which can be used to change the object of the statement.
     */
  }, {
    key: "update_statement",
    value: function update_statement(statement) {
      if (statement && !statement.graph) {
        return;
      }
      var updater = this;
      var context = this.statementContext(statement);
      return {
        statement: statement ? [statement.subject, statement.predicate, statement.object, statement.graph] : undefined,
        statementNT: statement ? this.anonymizeNT(statement) : undefined,
        where: updater.contextWhere(context),
        set_object: function set_object(obj, callbackFunction) {
          var query = this.where;
          query += 'DELETE DATA { ' + this.statementNT + ' } ;\n';
          query += 'INSERT DATA { ' +
          // @ts-ignore `this` might refer to the wrong scope. Does this work?
          this.anonymize(this.statement[0]) + ' ' +
          // @ts-ignore
          this.anonymize(this.statement[1]) + ' ' +
          // @ts-ignore
          this.anonymize(obj) + ' ' + ' . }\n';
          updater.fire(this.statement[3].value, query, callbackFunction);
        }
      };
    }
  }, {
    key: "insert_statement",
    value: function insert_statement(st, callbackFunction) {
      var st0 = st instanceof Array ? st[0] : st;
      var query = this.contextWhere(this.statementContext(st0));
      if (st instanceof Array) {
        var stText = '';
        for (var i = 0; i < st.length; i++) stText += st[i] + '\n';
        query += 'INSERT DATA { ' + stText + ' }\n';
      } else {
        query += 'INSERT DATA { ' + this.anonymize(st.subject) + ' ' + this.anonymize(st.predicate) + ' ' + this.anonymize(st.object) + ' ' + ' . }\n';
      }
      this.fire(st0.graph.value, query, callbackFunction);
    }
  }, {
    key: "delete_statement",
    value: function delete_statement(st, callbackFunction) {
      var st0 = st instanceof Array ? st[0] : st;
      var query = this.contextWhere(this.statementContext(st0));
      if (st instanceof Array) {
        var stText = '';
        for (var i = 0; i < st.length; i++) stText += st[i] + '\n';
        query += 'DELETE DATA { ' + stText + ' }\n';
      } else {
        query += 'DELETE DATA { ' + this.anonymize(st.subject) + ' ' + this.anonymize(st.predicate) + ' ' + this.anonymize(st.object) + ' ' + ' . }\n';
      }
      this.fire(st0.graph.value, query, callbackFunction);
    }

    /// //////////////////////

    /**
     * Requests a now or future action to refresh changes coming downstream
     * This is designed to allow the system to re-request the server version,
     * when a websocket has pinged to say there are changes.
     * If the websocket, by contrast, has sent a patch, then this may not be necessary.
     *
     * @param doc
     * @param action
     */
  }, {
    key: "requestDownstreamAction",
    value: function requestDownstreamAction(doc, action) {
      var control = this.patchControlFor(doc);
      if (!control.pendingUpstream) {
        action(doc);
      } else {
        if (control.downstreamAction) {
          if ('' + control.downstreamAction !== '' + action) {
            // Kludge compare
            throw new Error("Can't wait for > 1 different downstream actions");
          }
        } else {
          control.downstreamAction = action;
        }
      }
    }

    /**
     * We want to start counting websocket notifications
     * to distinguish the ones from others from our own.
     */
  }, {
    key: "clearUpstreamCount",
    value: function clearUpstreamCount(doc) {
      var control = this.patchControlFor(doc);
      control.upstreamCount = 0;
    }
  }, {
    key: "getUpdatesVia",
    value: function getUpdatesVia(doc) {
      var linkHeaders = this.store.fetcher.getHeader(doc, 'updates-via');
      if (!linkHeaders || !linkHeaders.length) return null;
      return linkHeaders[0].trim();
    }
  }, {
    key: "addDownstreamChangeListener",
    value: function addDownstreamChangeListener(doc, listener) {
      var _this2 = this;
      var control = this.patchControlFor(doc);
      if (!control.downstreamChangeListeners) {
        control.downstreamChangeListeners = [];
      }
      control.downstreamChangeListeners.push(listener);
      this.setRefreshHandler(doc, function (doc) {
        _this2.reloadAndSync(doc);
      });
    }
  }, {
    key: "reloadAndSync",
    value: function reloadAndSync(doc) {
      var control = this.patchControlFor(doc);
      var updater = this;
      if (control.reloading) {
        // console.log('   Already reloading - note this load may be out of date')
        control.outOfDate = true;
        return; // once only needed @@ Not true, has changed again
      }

      control.reloading = true;
      var retryTimeout = 1000; // ms
      var tryReload = function tryReload() {
        // console.log('try reload - timeout = ' + retryTimeout)
        updater.reload(updater.store, doc, function (ok, message, response) {
          if (ok) {
            if (control.downstreamChangeListeners) {
              for (var i = 0; i < control.downstreamChangeListeners.length; i++) {
                // console.log('        Calling downstream listener ' + i)
                control.downstreamChangeListeners[i]();
              }
            }
            control.reloading = false;
            if (control.outOfDate) {
              // console.log('   Extra reload because of extra update.')
              control.outOfDate = false;
              tryReload();
            }
          } else {
            control.reloading = false;
            if (response.status === 0) {
              // console.log('Network error refreshing the data. Retrying in ' +
              // retryTimeout / 1000)
              control.reloading = true;
              retryTimeout = retryTimeout * 2;
              setTimeout(tryReload, retryTimeout);
            } else {
              // console.log('Error ' + (response as Response).status + 'refreshing the data:' +
              //  message + '. Stopped' + doc)
            }
          }
        });
      };
      tryReload();
    }

    /**
     * Sets up websocket to listen on
     *
     * There is coordination between upstream changes and downstream ones
     * so that a reload is not done in the middle of an upstream patch.
     * If you use this API then you get called when a change happens, and you
     * have to reload the file yourself, and then refresh the UI.
     * Alternative is addDownstreamChangeListener(), where you do not
     * have to do the reload yourself. Do mot mix them.
     *
     * kb contains the HTTP  metadata from previous operations
     *
     * @param doc
     * @param handler
     *
     * @returns {boolean}
     */
  }, {
    key: "setRefreshHandler",
    value: function setRefreshHandler(doc, handler) {
      var wssURI = this.getUpdatesVia(doc); // relative
      // var kb = this.store
      var theHandler = handler;
      var self = this;
      var updater = this;
      var retryTimeout = 1500; // *2 will be 3 Seconds, 6, 12, etc
      var retries = 0;
      if (!wssURI) {
        // console.log('Server does not support live updates through Updates-Via :-(')
        return false;
      }
      wssURI = uriJoin(wssURI, doc.value);
      var validWssURI = wssURI.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      // console.log('Web socket URI ' + wssURI)

      var openWebsocket = function openWebsocket() {
        // From https://github.com/solid/solid-spec#live-updates
        var socket;
        if (typeof WebSocket !== 'undefined') {
          socket = new WebSocket(validWssURI);
        } else if (typeof window !== 'undefined' && window.WebSocket) {
          socket = window.WebSocket(validWssURI);
        } else {
          // console.log('Live update disabled, as WebSocket not supported by platform :-(')
          return;
        }
        socket.onopen = function () {
          // console.log('    websocket open')
          retryTimeout = 1500; // reset timeout to fast on success
          this.send('sub ' + doc.value);
          if (retries) {
            // console.log('Web socket has been down, better check for any news.')
            updater.requestDownstreamAction(doc, theHandler);
          }
        };
        var control = self.patchControlFor(doc);
        control.upstreamCount = 0;
        socket.onerror = function onerror(err) {
          // console.log('Error on Websocket:', err)
        };

        // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
        //
        // 1000  CLOSE_NORMAL  Normal closure; the connection successfully completed whatever purpose for which it was created.
        // 1001  CLOSE_GOING_AWAY  The endpoint is going away, either
        //                                  because of a server failure or because the browser is navigating away from the page that opened the connection.
        // 1002  CLOSE_PROTOCOL_ERROR  The endpoint is terminating the connection due to a protocol error.
        // 1003  CLOSE_UNSUPPORTED  The connection is being terminated because the endpoint
        //                                  received data of a type it cannot accept (for example, a text-only endpoint received binary data).
        // 1004                             Reserved. A meaning might be defined in the future.
        // 1005  CLOSE_NO_STATUS  Reserved.  Indicates that no status code was provided even though one was expected.
        // 1006  CLOSE_ABNORMAL  Reserved. Used to indicate that a connection was closed abnormally (
        //
        //
        socket.onclose = function (event) {
          // console.log('*** Websocket closed with code ' + event.code +
          //   ", reason '" + event.reason + "' clean = " + event.wasClean)
          retryTimeout *= 2;
          retries += 1;
          // console.log('Retrying in ' + retryTimeout + 'ms') // (ask user?)
          setTimeout(function () {
            // console.log('Trying websocket again')
            openWebsocket();
          }, retryTimeout);
        };
        socket.onmessage = function (msg) {
          if (msg.data && msg.data.slice(0, 3) === 'pub') {
            if ('upstreamCount' in control) {
              control.upstreamCount -= 1;
              if (control.upstreamCount >= 0) {
                // console.log('just an echo: ' + control.upstreamCount)
                return; // Just an echo
              }
            }
            // console.log('Assume a real downstream change: ' + control.upstreamCount + ' -> 0')
            control.upstreamCount = 0;
            self.requestDownstreamAction(doc, theHandler);
          }
        };
      }; // openWebsocket
      openWebsocket();
      return true;
    }

    /**
     * This high-level function updates the local store iff the web is changed successfully.
     * Deletions, insertions may be undefined or single statements or lists or formulae (may contain bnodes which can be indirectly identified by a where clause).
     * The `why` property of each statement must be the give the web document to be updated.
     * The statements to be deleted and inserted may span more than one web document.
     * @param deletions - Statement or statements to be deleted.
     * @param insertions - Statement or statements to be inserted.
     * @returns a promise
     */
  }, {
    key: "updateMany",
    value: function updateMany(deletions) {
      var insertions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      var docs = deletions.concat(insertions).map(function (st) {
        return st.why;
      });
      var thisUpdater = this;
      var uniqueDocs = [];
      docs.forEach(function (doc) {
        if (!uniqueDocs.find(function (uniqueDoc) {
          return uniqueDoc.equals(doc);
        })) uniqueDocs.push(doc);
      });
      var updates = uniqueDocs.map(function (doc) {
        return thisUpdater.update(deletions.filter(function (st) {
          return st.why.equals(doc);
        }), insertions.filter(function (st) {
          return st.why.equals(doc);
        }));
      });
      if (updates.length > 1) {
        // console.log(`@@ updateMany to ${updates.length}: ${uniqueDocs}`)
      }
      return Promise.all(updates);
    }

    /**
     * This high-level function updates the local store iff the web is changed successfully.
     * Deletions, insertions may be undefined or single statements or lists or formulae (may contain bnodes which can be indirectly identified by a where clause).
     * The `why` property of each statement must be the same and give the web document to be updated.
     * @param deletions - Statement or statements to be deleted.
     * @param insertions - Statement or statements to be inserted.
     * @param callback - called as callbackFunction(uri, success, errorbody)
     *           OR returns a promise
     * @param options - Options for the fetch call
     */
  }, {
    key: "update",
    value: function update(deletions, insertions, callback, secondTry) {
      var _this3 = this;
      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      if (!callback) {
        var thisUpdater = this;
        return new Promise(function (resolve, reject) {
          // Promise version
          thisUpdater.update(deletions, insertions, function (uri, ok, errorBody) {
            if (!ok) {
              reject(new Error(errorBody));
            } else {
              resolve();
            }
          }, secondTry, options); // callbackFunction
        }); // promise
      } // if

      try {
        var kb = this.store;
        var ds = !deletions ? [] : isStore(deletions) ? deletions.statements : deletions instanceof Array ? deletions : [deletions];
        var is = !insertions ? [] : isStore(insertions) ? insertions.statements : insertions instanceof Array ? insertions : [insertions];
        if (!(ds instanceof Array)) {
          throw new Error('Type Error ' + _typeof(ds) + ': ' + ds);
        }
        if (!(is instanceof Array)) {
          throw new Error('Type Error ' + _typeof(is) + ': ' + is);
        }
        if (ds.length === 0 && is.length === 0) {
          return callback(null, true); // success -- nothing needed to be done.
        }

        var doc = ds.length ? ds[0].graph : is[0].graph;
        if (!doc) {
          var _message2 = 'Error patching: statement does not specify which document to patch:' + ds[0] + ', ' + is[0];
          // console.log(message)
          throw new Error(_message2);
        }
        if (doc.termType !== 'NamedNode') {
          var _message3 = 'Error patching: document not a NamedNode:' + ds[0] + ', ' + is[0];
          // console.log(message)
          throw new Error(_message3);
        }
        var control = this.patchControlFor(doc);
        var startTime = Date.now();
        var props = ['subject', 'predicate', 'object', 'why'];
        var verbs = ['insert', 'delete'];
        var clauses = {
          'delete': ds,
          'insert': is
        };
        verbs.map(function (verb) {
          clauses[verb].map(function (st) {
            if (!doc.equals(st.graph)) {
              throw new Error('update: destination ' + doc + ' inconsistent with delete quad ' + st.graph);
            }
            props.map(function (prop) {
              if (typeof st[prop] === 'undefined') {
                throw new Error('update: undefined ' + prop + ' of statement.');
              }
            });
          });
        });
        var protocol = this.editable(doc.value, kb);
        if (protocol === false) {
          throw new Error('Update: Can\'t make changes in uneditable ' + doc);
        }
        if (protocol === undefined) {
          // Not enough metadata
          if (secondTry) {
            throw new Error('Update: Loaded ' + doc + "but stil can't figure out what editing protcol it supports.");
          }
          // console.log(`Update: have not loaded ${doc} before: loading now...`);
          this.store.fetcher.load(doc).then(function (response) {
            _this3.update(deletions, insertions, callback, true, options);
          }, function (err) {
            if (err.response.status === 404) {
              // nonexistent files are fine
              _this3.update(deletions, insertions, callback, true, options);
            } else {
              throw new Error("Update: Can't get updatability status ".concat(doc, " before patching: ").concat(err));
            }
          });
          return;
        } else if (protocol.indexOf('SPARQL') >= 0) {
          var bnodes = [];
          // change ReadOnly type to Mutable type

          if (ds.length) bnodes = this.statementArrayBnodes(ds);
          if (is.length) bnodes = bnodes.concat(this.statementArrayBnodes(is));
          var context = this.bnodeContext(bnodes, doc);
          var whereClause = this.contextWhere(context);
          var query = '';
          if (whereClause.length) {
            // Is there a WHERE clause?
            if (ds.length) {
              query += 'DELETE { ';
              for (var i = 0; i < ds.length; i++) {
                query += this.anonymizeNT(ds[i]) + '\n';
              }
              query += ' }\n';
            }
            if (is.length) {
              query += 'INSERT { ';
              for (var _i5 = 0; _i5 < is.length; _i5++) {
                query += this.anonymizeNT(is[_i5]) + '\n';
              }
              query += ' }\n';
            }
            query += whereClause;
          } else {
            // no where clause
            if (ds.length) {
              query += 'DELETE DATA { ';
              for (var _i6 = 0; _i6 < ds.length; _i6++) {
                query += this.anonymizeNT(ds[_i6]) + '\n';
              }
              query += ' } \n';
            }
            if (is.length) {
              if (ds.length) query += ' ; ';
              query += 'INSERT DATA { ';
              for (var _i7 = 0; _i7 < is.length; _i7++) {
                query += this.nTriples(is[_i7]) + '\n';
              }
              query += ' }\n';
            }
          }
          // Track pending upstream patches until they have finished their callbackFunction
          control.pendingUpstream = control.pendingUpstream ? control.pendingUpstream + 1 : 1;
          if ('upstreamCount' in control) {
            control.upstreamCount += 1; // count changes we originated ourselves
            // console.log('upstream count up to : ' + control.upstreamCount)
          }

          this.fire(doc.value, query, function (uri, success, body, response) {
            response.elapsedTimeMs = Date.now() - startTime;
            /* console.log('    UpdateManager: Return ' +
              (success ? 'success ' : 'FAILURE ') + (response as Response).status +
              ' elapsed ' + (response as any).elapsedTimeMs + 'ms')
              */
            if (success) {
              try {
                kb.remove(ds);
              } catch (e) {
                success = false;
                body = 'Remote Ok BUT error deleting ' + ds.length + ' from store!!! ' + e;
              } // Add in any case -- help recover from weirdness??
              for (var _i8 = 0; _i8 < is.length; _i8++) {
                kb.add(is[_i8].subject, is[_i8].predicate, is[_i8].object, doc);
              }
            }
            callback(uri, success, body, response);
            control.pendingUpstream -= 1;
            // When upstream patches have been sent, reload state if downstream waiting
            if (control.pendingUpstream === 0 && control.downstreamAction) {
              var downstreamAction = control.downstreamAction;
              delete control.downstreamAction;
              // console.log('delayed downstream action:')
              downstreamAction(doc);
            }
          }, options);
        } else if (protocol.indexOf('DAV') >= 0) {
          this.updateDav(doc, ds, is, callback, options);
        } else {
          if (protocol.indexOf('LOCALFILE') >= 0) {
            try {
              this.updateLocalFile(doc, ds, is, callback, options);
            } catch (e) {
              callback(doc.value, false, 'Exception trying to write back file <' + doc.value + '>\n'
              // + tabulator.Util.stackString(e))
              );
            }
          } else {
            throw new Error("Unhandled edit method: '" + protocol + "' for " + doc);
          }
        }
      } catch (e) {
        callback(undefined, false, 'Exception in update: ' + e + '\n' + Util.stackString(e));
      }
    }
  }, {
    key: "updateDav",
    value: function updateDav(doc, ds, is, callbackFunction) {
      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      var kb = this.store;
      // The code below is derived from Kenny's UpdateCenter.js
      var request = kb.any(doc, this.ns.link('request'));
      if (!request) {
        throw new Error('No record of our HTTP GET request for document: ' + doc);
      } // should not happen
      var response = kb.any(request, this.ns.link('response'));
      if (!response) {
        return null; // throw "No record HTTP GET response for document: "+doc
      }

      var contentType = kb.the(response, this.ns.httph('content-type')).value;

      // prepare contents of revised document
      var newSts = kb.statementsMatching(undefined, undefined, undefined, doc).slice(); // copy!
      for (var i = 0; i < ds.length; i++) {
        Util.RDFArrayRemove(newSts, ds[i]);
      }
      for (var _i9 = 0; _i9 < is.length; _i9++) {
        newSts.push(is[_i9]);
      }
      var documentString = this.serialize(doc.value, newSts, contentType);

      // Write the new version back
      var candidateTarget = kb.the(response, this.ns.httph('content-location'));
      var targetURI;
      if (candidateTarget) {
        targetURI = uriJoin(candidateTarget.value, targetURI);
      }
      options.contentType = contentType;
      options.noMeta = true;
      options.body = documentString;
      return kb.fetcher.webOperation('PUT', targetURI, options).then(function (response) {
        if (!response.ok) {
          throw new Error(response.error);
        }
        for (var _i10 = 0; _i10 < ds.length; _i10++) {
          kb.remove(ds[_i10]);
        }
        for (var _i11 = 0; _i11 < is.length; _i11++) {
          kb.add(is[_i11].subject, is[_i11].predicate, is[_i11].object, doc);
        }
        callbackFunction(doc.value, response.ok, response.responseText, response);
      }).catch(function (err) {
        callbackFunction(doc.value, false, err.message, err);
      });
    }

    /**
     * Likely deprecated, since this lib no longer deals with browser extension
     *
     * @param doc
     * @param ds
     * @param is
     * @param callbackFunction
     * @param options
     */
  }, {
    key: "updateLocalFile",
    value: function updateLocalFile(doc, ds, is, callbackFunction) {
      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
      var kb = this.store;
      // console.log('Writing back to local file\n')

      // prepare contents of revised document
      var newSts = kb.statementsMatching(undefined, undefined, undefined, doc).slice(); // copy!

      for (var i = 0; i < ds.length; i++) {
        Util.RDFArrayRemove(newSts, ds[i]);
      }
      for (var _i12 = 0; _i12 < is.length; _i12++) {
        newSts.push(is[_i12]);
      }
      // serialize to the appropriate format
      var dot = doc.value.lastIndexOf('.');
      if (dot < 1) {
        throw new Error('Rewriting file: No filename extension: ' + doc.value);
      }
      var ext = doc.value.slice(dot + 1);
      var contentType = Fetcher.CONTENT_TYPE_BY_EXT[ext];
      if (!contentType) {
        throw new Error('File extension .' + ext + ' not supported for data write');
      }
      options.body = this.serialize(doc.value, newSts, contentType);
      options.contentType = contentType;
      kb.fetcher.webOperation('PUT', doc.value, options).then(function (response) {
        if (!response.ok) return callbackFunction(doc.value, false, response.error);
        for (var _i13 = 0; _i13 < ds.length; _i13++) {
          kb.remove(ds[_i13]);
        }
        for (var _i14 = 0; _i14 < is.length; _i14++) {
          kb.add(is[_i14].subject, is[_i14].predicate, is[_i14].object, doc);
        }
        callbackFunction(doc.value, true, ''); // success!
      });
    }

    /**
     * @throws {Error} On unsupported content type
     *
     * @returns {string}
     */
  }, {
    key: "serialize",
    value: function serialize(uri, data, contentType) {
      var kb = this.store;
      var documentString;
      if (typeof data === 'string') {
        return data;
      }

      // serialize to the appropriate format
      var sz = Serializer(kb);
      sz.suggestNamespaces(kb.namespaces);
      sz.setBase(uri);
      switch (contentType) {
        case 'text/xml':
        case 'application/rdf+xml':
          documentString = sz.statementsToXML(data);
          break;
        case 'text/n3':
        case 'text/turtle':
        case 'application/x-turtle': // Legacy
        case 'application/n3':
          // Legacy
          documentString = sz.statementsToN3(data);
          break;
        default:
          throw new Error('Content-type ' + contentType + ' not supported for data serialization');
      }
      return documentString;
    }

    /**
     * This is suitable for an initial creation of a document.
     */
  }, {
    key: "put",
    value: function put(doc, data, contentType, callback) {
      var _this4 = this;
      var kb = this.store;
      var documentString;
      return Promise.resolve().then(function () {
        documentString = _this4.serialize(doc.value, data, contentType);
        return kb.fetcher.webOperation('PUT', doc.value, {
          contentType: contentType,
          body: documentString
        });
      }).then(function (response) {
        if (!response.ok) {
          return callback(doc.value, response.ok, response.error, response);
        }
        delete kb.fetcher.nonexistent[doc.value];
        delete kb.fetcher.requested[doc.value]; // @@ could this mess with the requested state machine? if a fetch is in progress

        if (typeof data !== 'string') {
          data.map(function (st) {
            kb.addStatement(st);
          });
        }
        callback(doc.value, response.ok, '', response);
      }).catch(function (err) {
        callback(doc.value, false, err.message);
      });
    }

    /**
     * Reloads a document.
     *
     * Fast and cheap, no metadata. Measure times for the document.
     * Load it provisionally.
     * Don't delete the statements before the load, or it will leave a broken
     * document in the meantime.
     *
     * @param kb
     * @param doc {RDFlibNamedNode}
     * @param callbackFunction
     */
  }, {
    key: "reload",
    value: function reload(kb, doc, callbackFunction) {
      var startTime = Date.now();
      // force sets no-cache and
      var options = {
        force: true,
        noMeta: true,
        clearPreviousData: true
      };
      kb.fetcher.nowOrWhenFetched(doc.value, options, function (ok, body, response) {
        if (!ok) {
          // console.log('    ERROR reloading data: ' + body)
          callbackFunction(false, 'Error reloading data: ' + body, response);
          //@ts-ignore Where does onErrorWasCalled come from?
        } else if (response.onErrorWasCalled || response.status !== 200) {
          // console.log('    Non-HTTP error reloading data! onErrorWasCalled=' +
          //@ts-ignore Where does onErrorWasCalled come from?
          // response.onErrorWasCalled + ' status: ' + response.status)
          callbackFunction(false, 'Non-HTTP error reloading data: ' + body, response);
        } else {
          var elapsedTimeMs = Date.now() - startTime;
          if (!doc.reloadTimeTotal) doc.reloadTimeTotal = 0;
          if (!doc.reloadTimeCount) doc.reloadTimeCount = 0;
          doc.reloadTimeTotal += elapsedTimeMs;
          doc.reloadTimeCount += 1;

          // console.log('    Fetch took ' + elapsedTimeMs + 'ms, av. of ' +
          // doc.reloadTimeCount + ' = ' +
          // (doc.reloadTimeTotal / doc.reloadTimeCount) + 'ms.')

          callbackFunction(true);
        }
      });
    }
  }]);
  return UpdateManager;
}();
export { UpdateManager as default };