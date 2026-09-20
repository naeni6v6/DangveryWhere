<script lang="ts">
  import DogProfile from '$lib/mobile/screens/DogProfile.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<div class="mobile-feature mobile-dog">
  <DogProfile {data} basePath="" />
</div>
