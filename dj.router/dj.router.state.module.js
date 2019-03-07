/** 路由状态控制
 * 
 * @example 使用
 * @method 路由控制
 * @todo code:
    angular.module("your-module-name", ["...", "dj.router.state"]);
    // ...
    $rootScope.$on("$DjRouteChangeSuccess", function (event, newState, oldState) {
      // 可以判断是否是按了浏览器的后退按钮;
      var isGoBack = oldState && oldState.id > newState.id;
      // ...
      // 你还可以根据新旧 state 来自己实现路由对应视口
    });
 *
 *
 *
 *
 * @fires 触发路由变化的方式区分： *
 * @method 1、 地址栏输入新的hash，或直接设置location
 *       $locationChangeSuccess 事件中，无有效的 State,
 *       若hash未发生变化，则退出事件处理。
 *       首先，生成一个全新的 state, 在 StateCache 中的列表将增加到当前位置之后，且截断其后列表
 *       其次，替换 history,
 *       最后，发出通知 $DjRouteChangeSuccess
 * @method 2、 调用 DjState 类函数
 *       直接修改 history,
 *       直接修改 StateCache, 
 *         如果是全新的路由，则 StateCache 中的列表将增加一项到当前位置之后，且截断其后列表
 *         如果是跳转，则暂不处理
 *       此后，触发 $locationChangeSuccess 事件
 *         可识别到是有效的 State,
 *         在 StateCache 中更新当前位置
 *       最后，发出通知 $DjRouteChangeSuccess
 * @method 3、 浏览器的前进和后退功能
 *       由浏览器自动修改 history,
 *       首先，在$locationChangeSuccess 事件中
 *         得到一个有效的 state, 则在 StateCache 中更新当前位置, 最后，发出通知 $DjRouteChangeSuccess
 *         无有效的 state, 则按“方式1”处理
 *
 *
 *
 *
 * @event 路由即将改变
 * @description 在接收到 $locationChangeSuccess 通知，或者内部调用后，若可能发生路由改变，即生成新旧状态，发布通知
 * @override 允许 event.preventDefault()
 * @name $DjRouteChangeStart
 * @param event angular Event, Synthetic event object.
 * @param newState New State
 * @param oldState Old State
 *
 *
 * @event 路由改变成功
 * @name $DjRouteChangeSuccess
 * @param event angular Event, Synthetic event object.
 * @param newState New State
 * @param oldState Old State
 */

!(function (angular, window, undefined) {

  var theModule = angular.module("dj.router.state", []);

  /** 状态类 */
  var State;
  /** 历史类 */
  var DjHistory;
  /** 状态缓存 */
  var StateCache;

  /** 状态类 */
  State = (function () {

    /**
     * 根据参数，生成 hash
     */
    function hash(path, search) {
      search = search || {};
      var queryString = Object.keys(search).map(k => `${k}=${search[k]}`).join("&");
      return path + (queryString && "?" || "") + queryString;
    }
    function href(path, search) {
      return location.origin + location.pathname + "#/" + hash(path, search);
    }

    /**
     * 分析 url 中的 hash 部分
     * @return State对象
     */
    function parseHash(url) {
      var match = url.match(/#(!)?\/([^\?]+)(\?(.*))?$/) || [];
      var pathName = match[2];
      if (!pathName) { return false; }
      var queryString = match[4];
      var search = parseSearch(queryString);
      return new State(pathName, search);
    }

    /**
     * 分析 url 中的 queryString 参数
     * @return search
     */
    function parseSearch(queryString) {
      var search = {};
      if (queryString) {
        queryString.split("&").map(k_v => {
          k_v = k_v.split("=");
          if (k_v[1]) search[k_v[0]] = k_v[1];
        });
      }
      return search;
    }

    var State_ID = 0;
    /** 关键类 */
    function State(path, search) {
      this.path = path.replace(/^(\s|\/)+|(\s|\/)+$/gm, "");
      this.search = search;
      this.id = -1;
    }
    State.prototype = {
      autoID: function () {
        this.id = ++State_ID;
      },
      hash: function () {
        return hash(this.path, this.search);
      },
      href: function () {
        return href(this.path, this.search);
      },
      equals: function (state) {
        return state && state.hash && this.hash() == state.hash() || this.hash() == state;
      }
    }

    /** 静态函数 */
    State.parseHash = parseHash;
    State.hash = hash;
    State.href = href;

    return State;
  })();

  /** 历史类
   * 添加一个历史记录时，state.autoID
   */
  DjHistory = (function () {
    var CDjHistory = function () {
      /** 时间戳，用于标识 */
      this.t = +new Date();
      this.activeState = null;
    }
    CDjHistory.prototype = {
      getHistoryStateId: function () {
        return history.state && history.state.t === this.t && history.state.id || 0;
      },
      isHistoryStateId: function () {
        return history.state && history.state.t === this.t && history.state.id || 0;
      },
      equalsCurrentState: function (state) {
        if (!state instanceof State) return false;
        return this.activeState && state.equals(this.activeState);
      },
      goback: function () {
        history.go(-1);
      },
      forward: function () {
        history.go(1);
      },
      go(state) {
        location.href = state.href();
      },
      push(state) {
        this.activeState = state;
        history.pushState({ t: this.t, id: state.id, id: state.id }, null, state.href());
      },
      replace(state) {
        this.activeState = state;
        history.replaceState({ t: this.t, id: state.id }, null, state.href());
      },
    }
    return new CDjHistory();
  })();


  /** 主控路由
   * @ng-factory DjState
   *
   * 1. 保存路由序列
   * 2. 浏览器历史记录同步
   * 3. 路由漫游
   */
  theModule.factory("DjState", ["$rootScope", "$q", function ctrl($rootScope, $q) {

    /**
     * 不同参数方式，获取 State 对象
     */
    function stateOf(path, search) {
      if (path instanceof State) return path;
      return new State(path, search);
    }

    /**
     * 状态缓存
     */
    StateCache = {
      pos: -1,
      list: [],

      /**
       * 测试是否与当前状态相同
       */
      activeEquals: function (state) {
        var active = this.list[this.pos];
        return active && this.list[this.pos].equals(state);
      },

      /**
       * 跳到指定页面
       */
      navToPos: function (pos) {
        if (this.pos == pos || !this.list[pos]) return $q.reject("无效跳转");
        var oldState = this.list[this.pos];
        var newState = this.list[pos];
        this.pos = pos;
        return $q.when({ newState, oldState });
      },

      /**
       * 跳到最后一个页面
       */
      navToLast: function () {
        return this.navToPos(this.list.length - 1);
      },

      /**
       * 尝试切换路由到指定的状态ID
       * 正确返回 数字
       * 错误返回 错误字符串
       */
      checkNavigateTo: function (historyStateId) {
        var pos = this.list.findIndex(state => state.id == historyStateId);
        if (pos < 0) {
          return "error id";
        }
        if (pos === this.pos) {
          return "same pos";
        }
        return pos;
      },

      /**
       * 尝试切换路由到指定的状态ID
       */
      gotoHistoryPage: function (historyStateId) {
        var pos = StateCache.checkNavigateTo(historyStateId);
        if (!angular.isNumber(pos)) {
          return $q.reject(pos);
        }
        return this.navToPos(pos);
      },

      /**
       * 在当前位置之后，添加一个状态
       */
      appendState: function (state) {
        // 先清除之后的
        this.list.splice(this.pos + 1, 99999);
        // 添加一个新的状态，总是在最后
        this.list.push(state);
      },
    };

    /**
     * 主控路由
     */
    var DjState = {
      hash: State.hash,
      href: State.href,

      go: function (path, search) {
        var newState = stateOf(path, search);
        var oldState = State.parseHash(location.href);
        var defaultPrevented = $rootScope.$broadcast("$DjRouteChangeStart", newState, oldState).defaultPrevented;
        if (defaultPrevented) {
          return;
        }
        // 程序第一次设置 hash
        if (!DjHistory.activeState) {
          newState.autoID();
          DjHistory.replace(newState);
          return true;
        }
        // 不是第一次设置 hash 且url没有改变的，不处理
        if (location.href == newState.href()) {
          return false;
        };
        newState.autoID();
        DjHistory.push(newState);
        StateCache.appendState(newState);
        return true;
      },
      goback: function () {
        DjHistory.goback();
      },
      forward: function () {
        DjHistory.forward();
      },

      /**
       * 替换当前页面
       * 替换浏览器的历史记录的当前项
       * 页面将被重新加载
       */
      replace: function (path, search) {
        var state = stateOf(path, search);
        state.autoID();
        DjHistory.replace(state);
      },

      /**
       * 替换当前页面的 search 参数
       * 替换浏览器的历史记录的当前项
       * 页面将被重新加载
       */
      replaceSearch: function (search) {
        if (!DjHistory.activeState) return;
        var state = stateOf(DjHistory.activeState.path, search);
        state.autoID();
        DjHistory.replace(state);
      },
    }

    return DjState;
  }]);

  /** 路由事件处理
   *
   * 1. 监听 url 事件
   * 2. 广播路由事件
   */
  theModule.run(["$rootScope", "$location", "$q", "DjState", function ctrl($rootScope, $location, $q) {
    /**
     * @event $DjRouteChangeStart
     *
     * 路由即将发生变化
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {State} newState New State
     * @param {State} oldState State that was before it was changed.
     *
     */
    $rootScope.$on("$locationChangeStart", function (event, newUrl, oldUrl) {
      var newState = State.parseHash(newUrl);
      var oldState = State.parseHash(oldUrl);
      var defaultPrevented = $rootScope.$broadcast("$DjRouteChangeStart", newState, oldState).defaultPrevented;
      if (defaultPrevented) {
        event.preventDefault();
      }
    });

    /**
     * @event $DjRouteChangeSuccess
     *
     * 路由改变成功
     *
     * @param {Object} event angular Event, Synthetic event object.
     * @param {State} newState New State
     * @param {State} oldState Old State
     */
    function broadcastSuccess(states) {
      var newState = states.newState;
      var oldState = states.oldState;
      // console.log("路由广播, newState=", newState, ", oldState=", oldState);
      $rootScope.$broadcast("$DjRouteChangeSuccess", newState, oldState);
      return states;
    }
    $rootScope.$on("$locationChangeSuccess", function (event, newUrl, oldUrl) {
      // console.log("$locationChangeSuccess,", newUrl, oldUrl);
      /** 必须在 locationChangeSuccess 中才能正确得到 history 数据*/
      var historyStateId = DjHistory.getHistoryStateId();
      StateCache.gotoHistoryPage(historyStateId)
        .then(states => {
          // 是浏览器按了后退或前进
          // 是DjState操作后退或前进
          // 是DjState.go函数改变路由
          // console.log("路由改变, 后退、前进或DjState.go", historyStateId);
          broadcastSuccess(states);
          return states;
        })
        .catch((reason) => {
          // 新的 hash
          if (reason == "same pos") {
            // 新的 hash, 但调用了 history.replaceState
            // console.log("路由改变, 新的 hash, 但调用了 history.replaceState ", historyStateId);
            return $q.reject(reason);
          }
          else {
            // console.log("路由改变, 新的 hash,", historyStateId);
            //if(historyStateId)StateCache
            var newState = State.parseHash(newUrl);
            newState.autoID();
            StateCache.appendState(newState);
            return StateCache.navToLast().then(states => {
              DjHistory.replace(states.newState);
              broadcastSuccess(states);
              return states;
            });
          }
        });
    });
  }]);

})(angular, window);