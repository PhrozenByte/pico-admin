---
Title: Pico Admin
---

## Welcome to Pico's admin panel

### Install

**Step 1:** Create a authentication token. Please enter the password you want
to use to access the admin panel below and hit `Generate`:

<form action="" method="post">
    <input type="hidden" name="auth_client_salt" value="%meta.admin_auth_client_salt%" />
    <input type="password" name="auth_token" placeholder="Password" />
    <input type="submit" value="Generate" />
</form>

<div class="admin-token" data-token="%meta.admin_auth_token%" markdown="1">

**Step 2:** Add the following to your `config/config.php`:

```
$config['PicoAdmin']['auth_token'] = '%meta.admin_auth_token%';
$config['PicoAdmin']['auth_client_salt'] = '%meta.admin_auth_client_salt%';
```

**Step 3:** Browse to <a href="%base_url%?admin">%base_url%?admin</a> and login
with the password you configured.

</div>

### Security

TODO: Inform the user about client-side password hashing
