# NODE_EXPRESS_SERVER_DEPLOYMENT

###Deploying expressJS using pm2(npm module: npm install pm2 -g) <br/>
`pm2 start server.js`

```Generate Startup Script (to enable as system service)``` <br/>
`pm2 startup`

```Freeze your process list across server restart``` <br/>
`pm2 save`

```Remove Startup Script (to disable as system service)``` <br/>
`pm2 unstartup`


###Managing apps is straightforward:
```
$ pm2 stop     <app_name|namespace|id|'all'|json_conf>
$ pm2 restart  <app_name|namespace|id|'all'|json_conf>
$ pm2 delete   <app_name|namespace|id|'all'|json_conf>
```
