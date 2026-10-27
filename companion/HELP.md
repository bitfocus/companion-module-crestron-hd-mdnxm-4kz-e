## Crestron HD-MDNXM-4KZ-E

[API Docs](https://sdkcon78221.crestron.com/sdk/HD-MDNXM-4KZ-E_REST_API/Content/Topics/Home.htm)

This module uses HTTPS & Websocket protocols

The unit will lock out a user account after a number of failed login attempts, and lock out an IP after several more. For this reason do not use the sole admin account for Companion control - set up a dedicated companion user account.

If the connection drops, the module retries every 5 seconds until the unit is reachable and serving its login page. Once it has sent the username and password, it only retries if the unit stops answering altogether: any other failure could be the unit rejecting the login, and retrying that could trigger a lockout. In that case check the credentials and save the connection config to try again.

### Actions

- **Auto Route**

- **Output - Clear Route**

- **Output - Route Video**

- **Output - Route Audio** (only offered when the unit has audio routable inputs and outputs)

### Feedbacks - Boolean

- **Auto Route**

- **Destination - Sink Connected**

- **Destination - Audio Tally Source**

- **Destination - Video Tally Source**

- **Source - Sync Detected**

### Feedbacks - Value

- **Destination - Name**

- **Destination - Audio Source**

- **Destination - Video Source**

- **Source - Name**
