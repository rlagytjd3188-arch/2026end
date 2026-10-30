"""Consent helpers and a local-only Worker mock; never contact production."""
ENDPOINT='https://recovery44-upload.kh3188.workers.dev/'
def mock_uploads(context):
    context.route(ENDPOINT,lambda route:route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{"ok":true}'))
def accept_consent(page):
    page.wait_for_selector('#consent-dialog[open]');page.locator('#consent-accept').click()
