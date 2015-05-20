define([
  'angular',
  'app',
  'jquery',
  'lodash',
  'kbn',
  'moment',
  'services/panelSrv',
  'services/annotationsSrv',
  'services/datasourceSrv'
],
function (angular, app, $, _, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.panels.warning', []);
  app.useModule(module);

  module.directive("grafanaWarningPanel", function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      templateUrl: 'app/panels/warning/render.html',
      link: function(scope, elem) {
        var data;

        scope.$on('refresh', function() {
          scope.get_data();
        });

        scope.$on('render', function(event, renderData) {
          data = renderData || data;
          if (!data) {
            scope.get_data();
            return;
          }
          scope.data = data;
        });
      }
    };
  });

  module.controller('WarningCtrl', function($scope, $rootScope, panelSrv, annotationsSrv, timeSrv) {

    $scope.panelMeta = {
      description : "A panel that can be used to provide warnings about when a metric might cross a threshold.",
      editorTabs: []
    };

    $scope.targetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    $scope.newWarning = function() {

      if (typeof($scope.panel.counter) === 'undefined')
        $scope.panel.counter = 0;
      else
        $scope.panel.counter += 1;

      return {
        id: $scope.panel.counter,
        target: "",
        threshold: 0,
        op: 'gte'
      }
    };

    $scope.addWarning = function() {
      $scope.panel.warnings.push($scope.newWarning())
    };

    $scope.removeWarning = function(warning) {
        $scope.panel.warnings = _.without($scope.panel.warnings, warning);
    };

    var _d = {
      datasource: 'graphite',
      style: {},
      warnings: [$scope.newWarning()],
      timeProximityDays: 60,
      counter: 0
    };

    _.defaults($scope.panel, _d);

    $scope.updateTimeRange = function() {
        $scope.range = timeSrv.timeRange();
        $scope.rangeUnparsed = timeSrv.timeRange(false);
        $scope.resolution = Math.ceil($(window).width() * ($scope.panel.span / 12));
        $scope.interval = kbn.calculateInterval($scope.range, $scope.resolution, $scope.panel.interval);
    };

    $scope.targetFromWarning = function(warning) {
      return {
        target: "leastSquaresIntercept(" +
                 warning.target + "," +
                 warning.threshold + "," +
                 $scope.panel.timeProximityDays + "," +
                 warning.id + ")"
      };
    };

    $scope.get_data = function() {
        $scope.updateTimeRange();
        $scope.timeBarrier = moment().add($scope.panel.timeProximityDays, 'days').utc();
        $scope.timeNow = moment().utc();
        var metricsQuery = {
          range: $scope.rangeUnparsed,
          interval: $scope.interval,
          targets: _.map($scope.panel.warnings, $scope.targetFromWarning),
          format: 'json',
          maxDataPoints: $scope.resolution,
          cacheTimeout: $scope.panel.cacheTimeout
        };
        return $scope.datasource.query(metricsQuery)
          .then($scope.dataHandler)
          .then(null, function(err) {
            $scope.panelMeta.loading = false;
            $scope.panelMeta.error =  err.message || "Warnings data request error";
            $scope.inspector.error = err;
            $scope.render([]);
          });
    };

    $scope.movingTowards = function(warning, data) {
      if (warning.op == 'gte' && data.slope > 0)
        return true;
      else if (warning.op == 'lte' && data.slope < 0)
        return true;
      return false;
    };

    $scope.thresholdExceeded = function(warning, data) {
      if (warning.op == 'gte' && data.last >= warning.threshold)
        return true;
      else if (warning.op == 'lte' && data.last <= warning.threshold)
        return true;
      return false;
    };

    $scope.scaleToStars = function(value) {
      var maxStars = 5;
      var maxRSquared = 0.8;
      var r_squared = Math.min(value, maxRSquared);
      var scaled = r_squared / maxRSquared * maxStars;
      scaled = (Math.round(scaled * 2) / 2).toFixed(1);
      return {
        actual: scaled,
        whole: _.range(0, parseInt(scaled)),
        half: _.range(0, (parseInt(scaled * 2) % 2))
      }
    };

    $scope.warningHandler = function(seriesData, index) {
      var data = seriesData.datapoints[0][0];

      var warning = _.find($scope.panel.warnings, function(w) {
        return w.id == parseInt(data.id);
      });
      if (warning === undefined) {
        return;
      }

      var points = [
        data.intercepts.lower,
        data.intercepts.trend,
        data.intercepts.upper
      ];
      var min = _.min(points);
      var max = _.max(points);
      min = moment.utc(min * 1000);
      max = moment.utc(max * 1000);

      var state = 'ok';

      var hasExceeded = $scope.thresholdExceeded(warning, data);
      var isWorsening = $scope.movingTowards(warning, data);

      if (hasExceeded)
        state = 'critical';
      if (max < $scope.timeNow && isWorsening)
        state = 'critical';
      else if (min < $scope.timeNow && isWorsening)
        state = 'critical';
      else if (max < $scope.timeBarrier && isWorsening)
        state = 'warning';
      else if (min < $scope.timeBarrier && isWorsening)
        state = 'warning';

      var hue = 120;
      var stars = $scope.scaleToStars(data.r_squared);

      return {
        alias: seriesData.target,
        lower: min,
        upper: max,
        hue: hue,
        stars: stars,
        slope: data.slope,
        r_squared: Math.round(data.r_squared * 1000) / 1000,
        now: $scope.timeNow,
        barrier: $scope.timeBarrier,
        state: state
      }
    };

    $scope.dataHandler = function(results) {
      $scope.panelMeta.loading = false;
      var data = _.map(results.data, $scope.warningHandler);
      $scope.render(data);
    };

    $scope.render = function(data) {
        $scope.$emit('render', data);
    };

    panelSrv.init($scope);
  });
});
