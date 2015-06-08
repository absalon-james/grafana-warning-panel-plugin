Description
===========

A custom panel plugin written for grafana 1.8.1 that uses the custom
graphite-api processing functions found
[here](https://github.com/absalon-james/graphite_api_warning). The warning
panel makes a simplictic prediction as to whether or not a
metric will cross a specified threshold within a time window.

Installation
============

Clone this repo into the app/panels directory of your grafana installation.

```shell
cd $GRAFANA_DIR/app/panels
git clone https://github.com/absalon-james/grafana-warning-panel-plugin.git
mv grafana-warning-panel-plugin warning
```

Edit the config.js file found in the base directory of your grafana
installation. Make sure the string literal 'warning' is in the panel
plugins list.

```javascript
define(['settings'],
function (Settings) {
  return new Settings({

    ...
    plugins: {
      panels: ['warning']
    }
  });
});
```

Usage
=====

Creating a panel is the same as creating a text or graph panel. Simply add a
warning panel to a row.

The time proximity for each panel is the size of the time window in days.
Defaults to 60.

Metrics are configured as the metric target string and a
numeric threshold. Each warning panel can have multiple metrics.

Metrics with red exclamation marks have already crossed the threshold.  
Metrics with yellow exclamation marks indicate that the threshold willprobably be crossed within the time proximity.  
Metrics with a green check will probably not cross the threshold within the
time proximity.
