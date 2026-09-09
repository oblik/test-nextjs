Test cases (@todo):

- When the tags manifest loads, there's a pre-existing stale tag. The tags should get updated without explicitly getting mutated (revalidated) by the user code.
- When `revalidateTag` is called and there are more than 1 cache handlers registered, the tags manifest should be updated just once, not one time per handler.
