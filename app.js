var r           =       require('request'),
    u           =       require('underscore')._,
    router      =       require('router'),
    repl        =       require('repl');

// make it more understanding if opencv isn't installed
try {
    var cv          =       require('opencv');
} catch(e) {
    console.log("Couldn't find opencv, will continue without face detection")
}

var route       =       router();

var app         =       require('http').createServer(route),
    io          =       require('socket.io').listen(app, { log: false }),
    fs          =       require('fs');

    app.listen(3000);


var  out        =       console.log,
     username   =       require('./config').username || 'username',
     password   =       require('./config').password || 'password',
     poll_str   =       require('./config').poll_string || {},
     save_files =       require('./config').save_files || false,
     realm      =       'eagleeyenetworks',
     host       =       'https://eagleeyenetworks.com';

var user        =       {},
    devices     =       {
                            cameras: [],
                            bridges: []
                        };


var debug = function(arg) {
    repl.start({
      prompt: "node via stdin> ",
      input: process.stdin,
      output: process.stdout
    }).context.arg = arg;
};



function startUp(success, failure) {
    out('**********************************');
    out('           Starting up            ');
    out('**********************************');
    if ( typeof success === 'function') success(); // call success callback
}

function login(success, failure) {
    r.post({
            url: host + '/g/aaa/authenticate',
            json: true,
            body: { 'username': username, 'password': password, 'realm': realm }
            }, function(err, res, body) {
                if (err) { out(err.stack); }
                if (!err) {
                    switch(res.statusCode) {
                        case 200:
                            r.post({ url: host + '/g/aaa/authorize', json: true, body: { token: res.body.token } }, function(err, res, body) {
                               if (err) { out(err.stack); }
                               if (!err && res.statusCode == 200) {
                                    out('**********************************');
                                    out('           Logged in              ');
                                    out('**********************************');
                                    user = res.body;
                                    if ( typeof success === 'function') success(); // call success callback
                                }
                            })
                            break;
                        default:
                            out(res.statusCode + ': ' +  res.body);
                            if ( typeof failure === 'function') failure(); // call failure callback

                    }
                }
    })

}

function getDevices(success, failure) {
    r.get({url: host + '/g/list/devices', json: true }, function(err, res, body) {
        if (err) { out(err.stack) }
        if (!err && res.statusCode == 200) {
            out('**********************************');
            out('           Grabbed Devices        ');
            out('**********************************');

            u.each(res.body, function(device) {
                var tmp = {};
                if(device[3] === 'camera') {
                    tmp = {
                        deviceID:           device[1] || '',
                        deviceStatus:       device[5] || ''
                    };
                    devices.cameras.push(tmp);
                } else {
                    tmp = {
                        deviceID:           device[1] || '',
                        deviceStatus:       device[5] || ''
                    };
                    devices.bridges.push(tmp);
                }
            });

            if ( typeof success === 'function') success(); // call success callback
        }
    });
}

function startPolling(socket) {

    out('**********************************');
    out('           Start Polling          ');
    out('**********************************');

    r.post({
            url:    host + '/poll',
            json:   true,
            body:   JSON.stringify( poll_str)
           }, function(err, res, body) {
                if (err) { out(err.stack) };
                if (!err) {
                    switch(res.statusCode) {
                        case 200:
                        case 503:
                            keepPolling(socket);
                            break;
                         default:
                            out(res.statusCode);
                            out('**********************************');
                            out('           Restart Polling        ');
                            out('**********************************');
                            startPolling();
                            break;
                    }
                }

    });


}

function keepPolling(socket) {
    //out('**********************************');
    //out('           Keep Polling           ');
    //out('**********************************');

    r.get({
            url:    host + '/poll',
            json:   true,
           }, function(err, res, body) {
                if (err) { out(err.stack) };
                if (!err) {
                    switch(res.statusCode) {
                        case 200:
                            // got a valid polling cookie
                            processPollingData(socket, res.body);
                            keepPolling(socket);
                            break;
                        case 400:
                            // got an invalid polling cookie
                            //debug({ 'res': res, 'socket': socket });
                            break;
                        default:
                            out(res.statusCode);
                            out('**********************************');
                            out('           Restart Polling        ');
                            out('**********************************');
                            startPolling(socket);
                            break;
                    }
                }

    });

}

function processPollingData(socket, data) {
    //out('**********************************');
    //out('           Processing Data        ');
    //out('**********************************');
    //out(data);
    socket.emit('poll', { data: data });
}


io.sockets.on('connection', function (socket) {

    // tell the client what there id is
    socket.send(socket.id);
    out('Client\'s socket id is: ' + socket.id);

    startUp( function() {
        login( function() {
            getDevices(function() {
                startPolling(socket)
            });
        },
        // failure case for login
        function() {
            console.log('Failed to login using these credentials  ' + username + ' : ' + password );
        });
    });
});

io.sockets.on('disconnect', function(socket) {
    out('socket disconnected', socket);
});

route.get('/image/{device}/{ts}', function(orig_req, orig_res) {
    var ts      =   orig_req.params.ts,
        device  =   orig_req.params.device;

    //console.log('DEBUG: matching /image/' + device + '/' + ts);

    ts = (ts.indexOf('now') >= -1) ? 'now' : ts;

    var url = host + '/asset/prev/image.jpeg?c=' + device + ';t=' + ts + ';q=high;a=pre';

    try {
        //r.get(url).pipe(orig_res)
        r.get({uri:url, encoding:'binary'}, function(err, resp, body) {
        
        if(cv) {
            cv.readImage(new Buffer(body, 'binary'), function(err, im){
                im.detectObject(cv.FACE_CASCADE, {}, function(err, faces){
                    if(faces.length > 0) {
                        for (var i=0;i<faces.length; i++){
                    	    var x = faces[i]
                            im.ellipse(x.x + x.width/2, x.y + x.height/2, x.width/2, x.height/2);
                        }
                        console.log('found a face');
                        if(save_files) im.save('./out-' + new Date().valueOf() + '.jpg');
                    } else {
			            im.convertGrayscale();
		            }
                orig_res.writeHead(200, {'Content-Type': 'image/jpeg'});  
                orig_res.end(im.toBuffer()); 
                });
            }) 
        } else {
            orig_res.writeHead(200, {'Content-Type': 'image/jpeg'});  
            orig_res.end(new Buffer(body, 'binary')); 
        }

        })
    } catch(e) {
        out('error in fetching images: ', e)
    }

});


route.get('/jquery.preview.js', function(req, res) {
  fs.readFile(__dirname + '/jquery.preview.js',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading /jquery.preview.js');
    }

    res.writeHead(200);
    res.end(data);

    out('serving /jquery.preview.js');

  });
});

route.get('/page.html', function(req, res) {
  fs.readFile(__dirname + '/page.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading page.html');
    }

    res.writeHead(200);
    res.end(data);

    out('serving /page.html');

  });
});

route.get('*', function(req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);

    out('serving /index.html');

  });
});



process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
  switch(err) {
    case 'Error: Parse Error':
        out(err);
        break;
  }
});
