# Evidence review

This directory holds maintainer-supplied scam-image samples for peer review.

## Workflow

1. Add a non-private candidate image to `pending/` in a pull request.
2. Record its source and why it is safe to redistribute in the pull-request description.
3. After peer review, move an accepted sample to `approved/`.
4. Review the raw image in the same pull request. ScamGuard hashes approved files directly when it starts.

Only raw images in `approved/` contribute to detection. `pending/` never affects detection. ScamGuard reads approved images at startup and never writes runtime images into either directory.

Do not commit private Discord content, personal data, credentials, access tokens, or images without redistribution permission.
