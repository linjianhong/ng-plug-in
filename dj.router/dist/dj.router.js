"use strict";

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * @license AngularDjRouter v0.0.1
 * (c) 2010-2016 Google, Inc. https://jdyhy.com
 * License: MIT
 * @module dj.router.frame
 * @author LinJH [ljh@jdyhy.com]
 * @copyright DJ. 2014-2017
 *
 *
 *
 * @description 轻量级路由
 * @function 1: 各路由显示的内容，可以暂时隐藏的方式保存在内存中，后退时，可以立即显示, 也可以自动销毁
 * @function 2: 有效识别浏览器的前进后退操作
 * @function 3: 以组件方式，绑定路由地址，无需另外绑定代码 (当前版本，组件名要加前缀"page-"以自动绑定)
 * @function 4: 路由切换监听，可以及时得到新旧路由的各种参数，用以通用功能的集中控制实现
 * 
 *
 * @throws {1} 绑定组件，须以 dj.router.frame 模块来定义组件
 * @throws {2} 路由切换时，页面动画的 css 类名，有时出现 ng-enter, 却没有 ng-hide-remove, 原因尚未明确
 * @throws {3} 当路由没有找到对应的组件定义时，路由将不会被切换。浏览器的url和前进后退操作，将造成一个不很正确的历史记录
 * 
 *
 *
 *
 *
 * @example 使用
 * @method 路由控制
 * @code 1.<js> sure module tobe loaded
    angular.module("app-module-name", ["...", "dj.router.frame"]);
 * @code 2.<html template>
 *  @param {string} hostCss class name append to every dj-frame-host element
    <dj-frame class="view-container {{isGoBack&&'back'||''}}" host-css="flex-v"></dj-frame>
 * @code 3.<js> add page bind router, such as #/pagename1
 *  @param {boolean} autoDestroy true: destroy element when state deactivated
 *  @param {any} angularComponentDefault angular.component param using
 *  @param {any} other as you need, the data can be recieved on event $DjRouteChangeStart, event $DjRouteChangeSuccess
    angular.module("dj.router.frame").component("page-pagename1", {
      pageTitle: "page title 1",
      requireLogin: true,
      autoDestroy: true,
      template: `<div>page 1!</div>`,
      controller: ["$scope", function ctrl($scope) {
      }]
    });
 *
 *
 *
 *
 *
 * @event 路由页面开始切换
 * @name $DjPageNavgateStart
 * @param event angular Event, Synthetic event object.
 * @param newPage New Page Data, include State, component and it's params
 * @param oldPage Old Page Data, include State, component and it's params
 */

!function (angular, window, undefined) {

  /** 限制缓存页面数量(未启用) */
  var MAX_CACHE_PAGE_COUNT = 50;

  var theModule = angular.module("dj.router.frame", ["ngAnimate", "dj.router.state"]);

  /** 原 component 函数 */
  var theOldComponentFunction = theModule.component;

  /** 组件信息收集 */
  var registerdComponents = [];

  /**
   * 字符串转成驼峰
   */
  function transformStr(str) {
    return str.replace(/-(\w)/g, function ($0, $1) {
      return $1.toUpperCase();
    });
  }
  /**
   * 驼峰转成-字符串
   */
  function untransformStr(str) {
    return str.replace(/([A-Z])/g, function ($0, $1) {
      return "-" + $1.toLowerCase();
    });
  }

  /**
   * 根据 pathName 查找组件信息
   * @return component
   */
  function findComponent(pathName) {
    if (!pathName) {
      return false;
    }
    var paths = pathName.split("/");
    var componentName = untransformStr(transformStr("page-" + paths.join("-")));
    var component = registerdComponents.find(function (component) {
      return component.param.path == pathName || component.name == componentName || component.componentName == componentName;
    });
    return component;
  }

  /** 拦截组件注册 */
  theModule.component = function (name, param) {
    var componentName = untransformStr(name);
    registerdComponents.push({ name: name, componentName: componentName, param: param });
    return theOldComponentFunction(transformStr(componentName), param);
  };

  /**
   * 
   */
  !function () {
    /** 框架页面类 */
    var CPageData;
    var CachePages;
    theModule.run(["$rootScope", "$q", function ($rootScope, $q) {
      CPageData = function () {
        function CPageData(state) {
          this.state = state;
          this.visible = false;
          this.fitstShow = true;
          this.component = findComponent(state.path);
        }
        CPageData.prototype = {
          show: function show() {
            this.visible = true;
            this.fitstShow = false;
          },
          hide: function hide() {
            this.visible = false;
          },
          getData: function getData() {
            return this.component && this.component.param && this.component.param.pageDatas;
          }
        };
        return CPageData;
      }();

      /** 框架历史浏览记录 */
      CachePages = {
        pos: -1,
        list: [],
        push: function push(page) {
          return this.list.push(page);
        },
        clearAfters: function clearAfters() {
          return this.list.splice(this.pos + 1, 99999);
        },
        findIndex: function findIndex(state) {
          return this.list.findIndex(function (page) {
            return page.state.id == state.id;
          });
        },

        onState: function onState(newState, oldState) {
          var oldPos = this.pos;
          var newPos = this.findIndex(newState);
          if (newPos < 0) {
            this.clearAfters();
            this.push(new CPageData(newState));
            newPos = this.list.length - 1;
          }
          return {
            oldPos: oldPos,
            newPos: newPos
          };
        },

        invalidate: function invalidate(changes) {
          // this.list.map(page => page.css = "");
          var oldPage = this.list[changes.oldPos];
          var newPage = this.list[changes.newPos];
          if (oldPage) oldPage.hide();
          if (newPage) newPage.show();
          // var animate = this.list.length > 1 && " animate" || ""
          // if (oldPage) oldPage.css = "dj-leave" + animate;
          // if (newPage) newPage.css = "dj-enter" + animate;
          this.pos = changes.newPos;
          // console.log("重新显示", changes);
          return { oldPage: oldPage, newPage: newPage };
        }
      };
    }]);

    /** 页面插座 */
    theModule.directive("djFrameHost", ["$parse", "$compile", function ($parse, $compile) {
      return {
        restrict: "AE",
        scope: {
          p: "="
        },
        //template: "<div></div>",
        link: function link(scope, element, attr) {
          scope.$watch("p", function (pageData) {
            // console.log("页面插座", pageData);
            if (!pageData || !pageData.state || !pageData.component || !pageData.component.componentName) {
              element.html("");
              return;
            }
            scope.state = pageData.state;
            var componentName = pageData.component.componentName;
            /** 新建一个组件DOM */
            var template = "<" + componentName + " serach=\"state.search\"></" + componentName + ">";
            element.html(template);
            $compile(element.contents())(scope);
          });
        }
      };
    }]);

    /**
     * 多页面控制
     */
    theModule.component("djFrame", {
      template: "<dj-frame-host class=\" {{$ctrl.hostCss||''}} {{page.component.param.pageCss}}\" ng-show=\"page.visible\" p=\"(page.visible||!page.component.param.autoDestroy)&&page\" ng-repeat=\"page in pageList\"></dj-frame-host>",
      bindings: {
        hostCss: "@"
      },
      controller: ["$scope", "$rootScope", "$q", "$element", "$timeout", function ctrl($scope, $rootScope, $q, $element, $timeout) {
        /** 框架历史浏览记录 */
        $scope.pageList = CachePages.list;

        $rootScope.$on("$DjRouteChangeStart", function (event, newState, oldState) {
          var component = findComponent(newState.path);
          if (!component) event.preventDefault();
        });

        $rootScope.$on("$DjRouteChangeSuccess", function (event, newState, oldState) {
          var changes = CachePages.onState(newState, oldState);
          var oldPage = CachePages.list[changes.oldPos];
          var newPage = CachePages.list[changes.newPos];
          $rootScope.$broadcast("$DjPageNavgateStart", newPage, oldPage);
          // 需要一些时间，以便新的窗口显示一下，使动画不受其显示过程影响
          //$q.when(1).then(()=>{
          //$timeout(() => {
          //var hide = document.querySelector(`[n='${oldState && oldState.id}']`, $element[0])||{};
          //var show = document.querySelector(`[n='${newState.id}']`, $element[0]);
          //console.log("hide 2 = ",hide.className);
          //console.log("show 2 = ",show.className);
          var pages = CachePages.invalidate(changes);
          $rootScope.$broadcast("$DjPageNavgation", { pages: pages, changes: changes, cache: CachePages });
          // $timeout(() => {
          //   console.log("hide 3 = ",hide.className);
          //   console.log("show 3 = ",show.className);
          // });
          // $timeout(() => {
          //   console.log("hide 4 = ",hide.className);
          //   console.log("show 4 = ",show.className);
          // },200);
          //}, 18);
          //})
        });
      }]
    });
  }();
}(angular, window);
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

!function (angular, window, undefined) {

  var theModule = angular.module("dj.router.state", []);

  /** 状态类 */
  var State;
  /** 历史类 */
  var DjHistory;
  /** 状态缓存 */
  var StateCache;

  /** 状态类 */
  State = function () {

    /**
     * 根据参数，生成 hash
     */
    function _hash(path, search) {
      search = search || {};
      var queryString = Object.keys(search).map(function (k) {
        return k + "=" + search[k];
      }).join("&");
      return path + (queryString && "?" || "") + queryString;
    }
    function _href(path, search) {
      return location.origin + location.pathname + "#/" + _hash(path, search);
    }

    /**
     * 分析 url 中的 hash 部分
     * @return State对象
     */
    function parseHash(url) {
      var match = url.match(/#(!)?\/([^\?]+)(\?(.*))?$/) || [];
      var pathName = match[2];
      if (!pathName) {
        return false;
      }
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
        queryString.split("&").map(function (k_v) {
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
      autoID: function autoID() {
        this.id = ++State_ID;
      },
      hash: function hash() {
        return _hash(this.path, this.search);
      },
      href: function href() {
        return _href(this.path, this.search);
      },
      equals: function equals(state) {
        return state && state.hash && this.hash() == state.hash() || this.hash() == state;
      }

      /** 静态函数 */
    };State.parseHash = parseHash;
    State.hash = _hash;
    State.href = _href;

    return State;
  }();

  /** 历史类
   * 添加一个历史记录时，state.autoID
   */
  DjHistory = function () {
    var CDjHistory = function CDjHistory() {
      /** 时间戳，用于标识 */
      this.t = +new Date();
      this.activeState = null;
    };
    CDjHistory.prototype = {
      getHistoryStateId: function getHistoryStateId() {
        return history.state && history.state.t === this.t && history.state.id || 0;
      },
      isHistoryStateId: function isHistoryStateId() {
        return history.state && history.state.t === this.t && history.state.id || 0;
      },
      equalsCurrentState: function equalsCurrentState(state) {
        if (!state instanceof State) return false;
        return this.activeState && state.equals(this.activeState);
      },
      goback: function goback() {
        history.go(-1);
      },
      forward: function forward() {
        history.go(1);
      },
      go: function go(state) {
        location.href = state.href();
      },
      push: function push(state) {
        this.activeState = state;
        history.pushState(_defineProperty({ t: this.t, id: state.id }, "id", state.id), null, state.href());
      },
      replace: function replace(state) {
        this.activeState = state;
        history.replaceState({ t: this.t, id: state.id }, null, state.href());
      }
    };
    return new CDjHistory();
  }();

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
      activeEquals: function activeEquals(state) {
        var active = this.list[this.pos];
        return active && this.list[this.pos].equals(state);
      },

      /**
       * 跳到指定页面
       */
      navToPos: function navToPos(pos) {
        if (this.pos == pos || !this.list[pos]) return $q.reject("无效跳转");
        var oldState = this.list[this.pos];
        var newState = this.list[pos];
        this.pos = pos;
        return $q.when({ newState: newState, oldState: oldState });
      },

      /**
       * 跳到最后一个页面
       */
      navToLast: function navToLast() {
        return this.navToPos(this.list.length - 1);
      },

      /**
       * 尝试切换路由到指定的状态ID
       * 正确返回 数字
       * 错误返回 错误字符串
       */
      checkNavigateTo: function checkNavigateTo(historyStateId) {
        var pos = this.list.findIndex(function (state) {
          return state.id == historyStateId;
        });
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
      gotoHistoryPage: function gotoHistoryPage(historyStateId) {
        var pos = StateCache.checkNavigateTo(historyStateId);
        if (!angular.isNumber(pos)) {
          return $q.reject(pos);
        }
        return this.navToPos(pos);
      },

      /**
       * 在当前位置之后，添加一个状态
       */
      appendState: function appendState(state) {
        // 先清除之后的
        this.list.splice(this.pos + 1, 99999);
        // 添加一个新的状态，总是在最后
        this.list.push(state);
      }
    };

    /**
     * 主控路由
     */
    var DjState = {
      hash: State.hash,
      href: State.href,

      go: function go(path, search) {
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
      goback: function goback() {
        DjHistory.goback();
      },
      forward: function forward() {
        DjHistory.forward();
      },

      /**
       * 替换当前页面
       * 替换浏览器的历史记录的当前项
       * 页面将被重新加载
       */
      replace: function replace(path, search) {
        var state = stateOf(path, search);
        state.autoID();
        DjHistory.replace(state);
      },

      /**
       * 替换当前页面的 search 参数
       * 替换浏览器的历史记录的当前项
       * 页面将被重新加载
       */
      replaceSearch: function replaceSearch(search) {
        if (!DjHistory.activeState) return;
        var state = stateOf(DjHistory.activeState.path, search);
        state.autoID();
        DjHistory.replace(state);
      }
    };

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
      StateCache.gotoHistoryPage(historyStateId).then(function (states) {
        // 是浏览器按了后退或前进
        // 是DjState操作后退或前进
        // 是DjState.go函数改变路由
        // console.log("路由改变, 后退、前进或DjState.go", historyStateId);
        broadcastSuccess(states);
        return states;
      }).catch(function (reason) {
        // 新的 hash
        if (reason == "same pos") {
          // 新的 hash, 但调用了 history.replaceState
          // console.log("路由改变, 新的 hash, 但调用了 history.replaceState ", historyStateId);
          return $q.reject(reason);
        } else {
          // console.log("路由改变, 新的 hash,", historyStateId);
          //if(historyStateId)StateCache
          var newState = State.parseHash(newUrl);
          newState.autoID();
          StateCache.appendState(newState);
          return StateCache.navToLast().then(function (states) {
            DjHistory.replace(states.newState);
            broadcastSuccess(states);
            return states;
          });
        }
      });
    });
  }]);
}(angular, window);