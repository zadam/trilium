import server from "../../../services/server.js";
import protectedSessionHolder from "../../../services/protected_session_holder.js";
import toastService from "../../../services/toast.js";
import OptionsWidget from "./options_widget.js";

const TPL = `
<div class="options-section">
    <h4 class="mfa-heading"></h4>
    
    <div class="alert alert-warning" role="alert" style="font-weight: bold; color: red !important;">
      Use TOTP to add an additional layer of security to safeguard your data.
    </div>
    
  <br>
  <h4>TOTP Settings</h4>
    <div>
      <label>
          Enable TOTP
      </label>
      <input type="checkbox" class="totp-enabled" />
    </div>

<br>
  <div>
      <div class="form-group">
        <label>Password confirmation</label>
        <input class="password form-control" type="password">
      </div>
      <div class="options-section">
        <label>
        TOTP Secret
        </label>
        <input class="totp-secret-input form-control" disabled="true" type="text">
        <button class="save-totp" disabled="true"> Save TOTP Secret </button>
      </div>
  </div>
    <br>
 <h4> Generate TOTP Secret </h4>
    <span class="totp-secret" >  </span>
    <br>
    <button class="regenerate-totp" disabled="true"> Regenerate TOTP Secret </button>
</div>`;

export default class MultiFactorAuthenticationOptions extends OptionsWidget {
  doRender() {
    this.$widget = $(TPL);

    this.$mfaHeadding = this.$widget.find(".mfa-heading");
    this.$regenerateTotpButton = this.$widget.find(".regenerate-totp");
    this.$totpEnabled = this.$widget.find(".totp-enabled");
    this.$totpSecret = this.$widget.find(".totp-secret");
    this.$totpSecretInput = this.$widget.find(".totp-secret-input");
    this.$saveTotpButton = this.$widget.find(".save-totp");
    this.$password = this.$widget.find(".password");

    this.$mfaHeadding.text("Time-Based One Time Password (TOTP)");
    this.generateKey();

    this.$totpEnabled.on("change", async () => {
      this.updateSecret();
    });

    this.$regenerateTotpButton.on("click", async () => {
      this.generateKey();
    });

    this.$saveTotpButton.on("click", async () => {
      this.saveTotpSecret();
    });

    this.$protectedSessionTimeout = this.$widget.find(
      ".protected-session-timeout-in-seconds"
    );
    this.$protectedSessionTimeout.on("change", () =>
      this.updateOption(
        "protectedSessionTimeout",
        this.$protectedSessionTimeout.val()
      )
    );
  }

  async updateSecret() {
    if (this.$totpEnabled.prop("checked")) server.post("totp/enable");
    else server.post("totp/disable");
  }

  async generateKey() {
    server.get("totp/generate").then((result) => {
      if (result.success) {
        this.$totpSecret.text(result.message);
      } else {
        toastService.showError(result.message);
      }
    });
  }

  optionsLoaded(options) {
    server.get("totp/enabled").then((result) => {
      if (result.success) {
        this.$totpEnabled.prop("checked", result.message);
        this.$totpSecretInput.prop("disabled", !result.message);
        this.$saveTotpButton.prop("disabled", !result.message);
        this.$totpSecret.prop("disapbled", !result.message);
        this.$regenerateTotpButton.prop("disabled", !result.message);
        this.$password.prop("disabled", !result.message);
      } else {
        toastService.showError(result.message);
      }
    });

    this.$protectedSessionTimeout.val(options.protectedSessionTimeout);
  }

  saveTotpSecret() {
    const key = this.$totpSecretInput.val();
    const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;

    if (key.length != 52) {
      toastService.showError("Invalid Secret", 2000);
      return;
    }
    if (regex.test(key)) {
      toastService.showError("Invalid Secret", 2000);
      return;
    }

    server
      .post("totp/set", {
        secret: this.$totpSecretInput.val(),
        password: this.$password.val(),
      })
      .then((result) => {
        if (result.success) {
          toastService.showError(
            "Password has been changed. Trilium will be reloaded after you press OK."
          );

          // password changed so current protected session is invalid and needs to be cleared
          protectedSessionHolder.resetProtectedSession();
        } else {
          toastService.showError(result.message);
        }
      });

    return false;
  }
}
