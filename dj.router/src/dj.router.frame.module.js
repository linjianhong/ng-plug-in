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

!(function (angular, window, undefined) {

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
    var component = registerdComponents.find(component => {
      return component.param.path == pathName || component.name == componentName || component.componentName == componentName;
    });
    return component;
  }

  /** 拦截组件注册 */
  theModule.component = function (name, param) {
    var componentName = untransformStr(name);
    registerdComponents.push({ name, componentName, param });
    return theOldComponentFunction(transformStr(componentName), param);
  }


  /**
   * 
   */
  !(function () {
    /** 框架页面类 */
    var CPageData
    var CachePages;
    theModule.run(["$rootScope", "$q", function ($rootScope, $q) {
      CPageData = (function () {
        function CPageData(state) {
          this.state = state;
          this.visible = false;
          this.fitstShow = true;
          this.component = findComponent(state.path);
        }
        CPageData.prototype = {
          show: function () {
            this.visible = true;
            this.fitstShow = false;
          },
          hide: function () {
            this.visible = false;
          },
          getData: function () {
            return this.component && this.component.param && this.component.param.pageDatas;
          }
        }
        return CPageData;
      })();

      /** 框架历史浏览记录 */
      CachePages = {
        pos: -1,
        list: [],
        push: function (page) {
          return this.list.push(page);
        },
        clearAfters: function () {
          return this.list.splice(this.pos + 1, 99999);
        },
        findIndex: function (state) {
          return this.list.findIndex(page => page.state.id == state.id);
        },

        onState: function (newState, oldState) {
          var oldPos = this.pos;
          var newPos = this.findIndex(newState);
          if (newPos < 0) {
            this.clearAfters();
            this.push(new CPageData(newState));
            newPos = this.list.length - 1;
          }
          return {
            oldPos,
            newPos
          }
        },

        invalidate: function (changes) {
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
          return { oldPage, newPage }
        },
      };
    }]);


    /** 页面插座 */
    theModule.directive("djFrameHost", ["$parse", "$compile", function ($parse, $compile) {
      return {
        restrict: "AE",
        scope: {
          p: "=",
        },
        //template: "<div></div>",
        link: function (scope, element, attr) {
          scope.$watch("p", function (pageData) {
            // console.log("页面插座", pageData);
            if (!pageData
              || !pageData.state
              || !pageData.component
              || !pageData.component.componentName
            ) {
              element.html("");
              return;
            }
            scope.state = pageData.state;
            var componentName = pageData.component.componentName;
            /** 新建一个组件DOM */
            var template = (`<${componentName} serach="state.search"></${componentName}>`);
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
      template: `<dj-frame-host class=" {{$ctrl.hostCss||''}} {{page.component.param.pageCss}}" ng-show="page.visible" p="(page.visible||!page.component.param.autoDestroy)&&page" ng-repeat="page in pageList"></dj-frame-host>`,
      bindings: {
        hostCss: "@"
      },
      controller: ["$scope", "$rootScope",
        "$q",
        "$element",
        "$timeout",
        function ctrl($scope, $rootScope, $q, $element, $timeout) {
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
            $rootScope.$broadcast("$DjPageNavgation", { pages, changes, cache: CachePages });
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
        }
      ]
    })

  })();
})(angular, window);