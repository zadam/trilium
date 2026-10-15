# Authentication
## First-run setup

A new server prints a **First-run setup token** in its startup log. Copy that token into the setup screen and, when asked, the first-password form. The token is valid for one hour and is never included in the page or its URL. If it expires, submitting again prints a replacement in the server log; restarting also creates a new token. For Docker, read it with `docker logs <container-name>`.

The token also protects database installation, backup restore and incoming sync seeds before the instance is claimed. When seeding from a desktop, enter the server's token in Options → Sync → First-run setup token before testing sync. The desktop's own trusted window does not need a console token.

Keep the server behind HTTPS when reaching it over a network. The setup token does not encrypt passwords, sync secrets or session cookies.

## Content Security Policy

The server sends a Content Security Policy on the application shell and shared pages. It allows the trusted boot scripts and scripts served by Trilium, and blocks arbitrary inline scripts, event-handler attributes and embedded objects. Frontend script notes still work through Trilium's scripting runtime. Put shared-page JavaScript in a script note referenced with `~shareJs`, rather than an inline script in HTML. Raw shared HTML is subject to the same policy.

## Disabling authentication

If you are running Trilium on `localhost` only or if authentication is handled by another component, you can disable Trilium’s authentication by adding the following to `config.ini`:

```
[General]
noAuthentication=true
```

Disabling authentication will bypass even the <a class="reference-link" href="Multi-factor%20authentication%20with%20TOTP.md">Multi-Factor Authentication</a> since v0.94.1.

## Understanding how the session works

Once logged into Trilium, the application will store this information about the login into a cookie on the browser, but also as a session on the server.

If “Remember me” is checked, then the login will expire in 21 days. This period can be adjusted by modifying the `Session.cookieMaxAge` value in `config.ini`. For example, to have the session expire in one day:

```
[Session]
cookieMaxAge=86400
```

When “Remember me” is unchecked, the behavior is different. At client/browser level the authentication does not have any expiration date, but it will be automatically cleared as soon as the user closes the browser. Nevertheless, the server will also dismiss this authentication in around 24 hours from the _last interaction with the application_.

## Viewing active sessions

The login sessions are now stored in the same <a class="reference-link" href="../../Advanced%20Usage/Database.md">Database</a> as the user data. In order to view which sessions are active, open the <a class="reference-link" href="../../Advanced%20Usage/Database/Manually%20altering%20the%20database/SQL%20Console.md">SQL Console</a> and run the following query:

```
SELECT * FROM sessions
```

Expired sessions are periodically cleaned by the server, generally an hourly interval.

## See also

*   <a class="reference-link" href="Multi-factor%20authentication%20with%20TOTP.md">Multi-Factor Authentication</a>