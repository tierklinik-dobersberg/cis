let running = false;

function done() {
  running = false;
}

function toggle(id, response, callback) {
  let other = id == 0 ? 1 : 0;
  Shelly.call(
    "Switch.Set",
    {
      id: other,
      on: false
    },
    function() {
      Shelly.call(
        "Switch.Set",
        {
          id: id,
          on: true,
          toggle_after: 2
        },
        function () {         
          if (callback) {
            callback(response);
          }
          
          response.code = 202;
          response.send();
        }
      )
    }
  );
}

HTTPServer.registerEndpoint("door", function(request, response){
  if (running) {
    response.code = 409
    response.send();
    return;  
  }
  
  if (!request.body) {
    response.code = 400
    
    response.send();
    return    
  }
  
  try {
    let payload = JSON.parse(request.body);
    
    if (!('action' in payload)) {
      throw {
        code: 400,
        message: "missing action in payload"
      }
    }
    
    running = true;
    
    switch (payload.action) {
      case 'lock':
        toggle(1, response, done);
        break;
        
      case 'unlock':
        toggle(0, response, done);
        break;
        
      case 'open':
        Shelly.call("Switch.Set", { id: 1, on: false}, function() {
          Shelly.call("Switch.Set", { id: 0, on: true}, function() {
             response.code = 202;
             response.send();
             
             Timer.set(payload.duration || 10*1000, false, function() {
                Shelly.call("Switch.Set", {id: 0, on: false}, done)
             })
          })
        })
        
        break;
        
      default:
        throw {
          message: "invalid action: " + payload.action,
          code: 400
        }
    }
    
  } catch (err) {
    response.code = err.code || 500;
    response.body = JSON.stringify({
      "error": err.message,
      "stacktrace": err.stracktrace,
    })
    
    response.send()
  }
})