# Evidence review

This directory holds maintainer-supplied scam-image samples for peer review.

## Workflow

1. Add a non-private candidate image to `pending/` in a pull request.
2. Record its source and why it is safe to redistribute in the pull-request description.
3. After peer review, move an accepted sample to `approved/`.
4. Regenerate the fingerprint manifest with the project script and review that change in the same commit.

Only `approved/` contributes to the general seed fingerprint manifest. `pending/` never affects detection. ScamGuard never writes runtime images into either directory.

Do not commit private Discord content, personal data, credentials, access tokens, or images without redistribution permission.
