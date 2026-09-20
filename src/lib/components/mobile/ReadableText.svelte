<script lang="ts">
  let { text }: { text: string } = $props();
  // Decimal weights and URLs stay intact; only sentence-ending punctuation followed by
  // whitespace creates a new group. A group moves to the next line if it cannot fit.
  const sentences = $derived(text.trim().split(/(?<=[.!?。！？])\s+/u));
</script>

{#each sentences as sentence, index}
  {#if index > 0}{' '}{/if}<span class="sentence">{sentence}</span>
{/each}

<style>
  .sentence {
    display: inline-block;
    max-width: 100%;
    vertical-align: top;
    word-break: keep-all;
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }
</style>
