import logging
import os

from browser_use import Tools
from browser_use.agent.views import ActionResult
from browser_use.browser import BrowserSession
from browser_use.browser.events import UploadFileEvent

logger = logging.getLogger(__name__)

tools = Tools()

@tools.action('Upload file to interactive element with file path')
async def upload_file(index: int, path: str, browser_session: BrowserSession, available_file_paths: list[str]):
	if path not in available_file_paths:
		return ActionResult(error=f'File path {path} is not available')

	if not os.path.exists(path):
		return ActionResult(error=f'File {path} does not exist')

	try:
		# Get the DOM element by index
		dom_element = await browser_session.get_dom_element_by_index(index)

		if dom_element is None:
			msg = f'No element found at index {index}'
			logger.info(msg)
			return ActionResult(error=msg)

		# Check if it's a file input element
		if dom_element.tag_name.lower() != 'input' or dom_element.attributes.get('type') != 'file':
			msg = f'Element at index {index} is not a file input element'
			logger.info(msg)
			return ActionResult(error=msg)

		# Dispatch the upload file event
		event = browser_session.event_bus.dispatch(UploadFileEvent(node=dom_element, file_path=path))
		await event

		msg = f'Successfully uploaded file to index {index}'
		logger.info(msg)
		return ActionResult(extracted_content=msg, include_in_memory=True)

	except Exception as e:
		msg = f'Failed to upload file to index {index}: {str(e)}'
		logger.info(msg)
		return ActionResult(error=msg)