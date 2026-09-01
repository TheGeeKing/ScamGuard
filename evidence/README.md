# Evidence review

This directory holds maintainer-supplied, curated scam-image samples for peer review and startup detection.

## Workflow

1. Add a non-private curated image directly to this directory in a pull request.
2. Record its source and why it is safe to redistribute in the pull-request description.
3. Review the raw image in the same pull request. ScamGuard hashes image files in this directory directly when it starts.

Raw images in this directory contribute to detection. ScamGuard reads them at startup and never writes runtime images here.

Do not commit private Discord content, personal data, credentials, access tokens, or images without redistribution permission.
