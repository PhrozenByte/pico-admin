---
Title: Pico Admin Panel
---

<style type="text/css">
    .admin-auth-token[data-auth-token=""] {
        display: none;
    }
</style>

## Welcome to Pico's Admin Panel

### Install

**Step 1:** Create a authentication token. Please enter the password you want
to use to access the admin panel below and hit `Generate`:

<form action="" method="post">
    <input type="hidden" name="auth_client_salt" value="%meta.admin_auth_client_salt%" />
    <input type="password" name="password" placeholder="Password" />
    <input type="submit" value="Generate" />
</form>

<div class="admin-auth-token" data-auth-token="%meta.admin_auth_token%" markdown="1">

**Step 2:** Add the following to your `config/config.php`:

```
$config['PicoAdmin']['auth_token'] = '%meta.admin_auth_token%';
$config['PicoAdmin']['auth_client_salt'] = '%meta.admin_auth_client_salt%';
```

**Step 3:** Browse to <a href="%admin_url%">%admin_url%</a> and login with the
password you've configured.

</div>

### Security

TODO: Inform the user that he should use HTTPS
