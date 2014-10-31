####Face Detection for Eagle Eye Networks Poll Stream####

This is a Node.js client that follows the [Eagle Eye Networks API](https://apidocs.eagleeyenetworks.com/apidocs/).  
It listens for new preview images and then sends them to the client through [Socket.io](http://socket.io).  
It will look for faces and show the image in color if it finds one.
It is also a good place to see a simplified version of subscribing to events.

#####Lifecycle of the app#####
The following steps need to be performed in order, but any call can be made once user is logged-in.

 - Login (step 1)
 - Login (step 2)
 - Current user's information is returned by Login (step 2)
 - Get device list
 - Subscribe to poll stream
 - Get subsequent events from poll stream

#####Installation#####

 - install [Node.js](http://nodejs.org)
 - run `npm install	` 
 - run `npm start	`
 - go to [http://localhost:3000](http://localhost:3000)


#####Configure#####

 Create a file named `config.js` and replace 'your_username' and 'your_password' with your username and password.  You will need to replace '<device_id>' with a device you are subscribing to.

    module.exports = {
        'username': 'your_username',
        'password':  'your_password',
        'poll_string': { 'cameras': {'<device_id>': {"resource": ["pre"]} }},
        'save_files': false
    };


