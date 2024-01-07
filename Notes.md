## Build steps notes

Electron and the host (may) use different version of node.  This becomes a problem when
native modules are compiled in `npm install`.  to solve this we need to install @electron/rebuild:
~~~
https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
~~~
And after each `npm install` run, run:
~~~
./node_modules/.bin/electron-rebuild
~~~
Source:
https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

## Source notes

This rebuilt project was based on https://github.com/electron-vite/electron-vite-vue

