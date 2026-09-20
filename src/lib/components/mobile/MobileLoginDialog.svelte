<script lang="ts">
  import AccountDialog from '$lib/components/AccountDialog.svelte';

  let {
    authEnabled = false,
    kakaoEnabled = false,
    returnPath = '/'
  }: {
    authEnabled?: boolean;
    kakaoEnabled?: boolean;
    returnPath?: string;
  } = $props();
  let accountDialog: AccountDialog;
  export function open() {
    return accountDialog?.open();
  }
  export function close() {
    accountDialog?.close();
  }
</script>

<AccountDialog
  bind:this={accountDialog}
  {authEnabled}
  {kakaoEnabled}
  {returnPath}
  variant="mobile"
/>
