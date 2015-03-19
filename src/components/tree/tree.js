define(['knockout', 'text!./tree.html'], function(ko, templateMarkup) {

	function Tree(params) {
		var self = this;

		this.visible = ko.observable(true).publishOn('tree.visibility');
		this.isDirty = ko.observable(false).publishOn('tree.isDirty');
		this.localStorageAvailable = ko.observable(false);
		this.expanded = ko.observable(true);

		this.shiftKeyPressed = false;
		this.draftTimestamp = new Date();
		this.lastEditTimestamp = this.draftTimestamp;

		this.colors = ko.observableArray([
			{ color: '#ed217c' },
			{ color: '#843b6e' },
			{ color: '#69a5d9' },
			{ color: '#4c8179' },
			{ color: '#bfd84b' },
			{ color: '#f2ba11' },
			{ color: '#f26611' },
			{ color: '#000000' }
		]);

		this.init = function() {
			self.localStorageAvailable(self.checkLocalstorage());
			if (self.localStorageAvailable()) {
				var draft = localStorage.getItem('draft') || '';
				var draftSave = window.setInterval(function() {
					if (self.draftTimestamp != self.lastEditTimestamp) {
						var draftData = $('#tree').html()
						localStorage.setItem('draft', draftData);
						self.draftTimestamp = self.lastEditTimestamp;
						// localStorage.setItem('draftId', self.treeId());
						// localStorage.setItem('draftTitle', self.treeTitle());
					}
				}, 5000);

				if (draft.length > 0) {
					var confirmLoad = confirm('There is an unsaved draft. Do you want to restore it?');
					if (confirmLoad) {
						// self.message('Loading...');
						// self.showMessage(true);
						var loader = window.setTimeout(function() {
							$('#tree').html(draft);
							self.scrub(draft);
							// self.showMessage(false);
							// self.message('');
							// self.treeTitle(localStorage.getItem('draftTitle'));
							// self.treeId(localStorage.getItem('draftId'));
							self.isDirty(true);
						}, 1500);
					} else {
						return;
					}
				} else {
					localStorage.setItem('draft', '');
				}
			}

			// listen for shift clicks on the nodes
			$('body').on('click', 'li', function(event) {
				if (event.offsetX < 0 && $(event.target).hasClass('has_children')) {
					var toggleTo = 'expanded';
					if ($(event.target).hasClass('collapsed')) {
						$(event.target).removeClass('collapsed');
					} else {
						$(event.target).addClass('collapsed');
						toggleTo = 'collapsed';
					}

					if (event.shiftKey) {
						if (window.getSelection) {
							if (window.getSelection().empty) {  // Chrome
								window.getSelection().empty();
							} else if (window.getSelection().removeAllRanges) {  // Firefox
							window.getSelection().removeAllRanges();
							}
						} else if (document.selection) {  // IE?
							document.selection.empty();
						}
						var children = $(event.target).next('ol').find('.has_children');
						$(children).each(function() {
							if (toggleTo == 'collapsed') {
								$(this).addClass('collapsed');
							} else {
								$(this).removeClass('collapsed');
							}
						});
					}
				}
			});
		}

		this.scrub = function(data) {
			var temp = $(data).clone();

			// first we need to go through and turn all the text into span tags and apply styles
			$(temp).find('li').each(function() {
				if ($(this).text() == '') {
					$(this).remove();
				} else {
					var current = $(this).text();
					var font = $(this).find('font').get(0);
					var bold = $(this).find('b,strong').get(0);
					var italic = $(this).find('i,em').get(0);
					var underlined = $(this).find('u').get(0);

					var nodeStyle = null;
					var span = document.createElement('span');

					// apply a color if added
					if (font) {
						color = $(font).attr('color');
						$(span).attr('style', 'border-color:'+color);
						$(span).attr('data-color', color);
					}

					// add the dialog class
					if (bold) {
						nodeStyle = 'dialog';
					} 

					// add the dialog class
					if (underlined) {
						nodeStyle = 'stacked';
					} 

					// add the component class
					if (italic) {
						nodeStyle = 'component';
					}
					
					$(span).addClass(nodeStyle).text(current);
					$(this).html(span);
				}
			});

			// now we need to embed the ol tags inside the parent li tag
			$(temp).find('ol').each(function() {
				var parent = $(this).prev('li');
				var list = $(this).detach();
				$(parent).append(list);
			});
			
			$('.tree-container').html(temp);
			ko.postbox.publish('renderTree');
		}

		this.render = function() {
			self.formatExpandCollapse();
			var data = $('#tree').html();
			self.scrub(data);
			self.isDirty(true);
			self.lastEditTimestamp = new Date();
		}

		this.apply = function(command, value) {
			var el = document.getElementById('tree');
			var value = value || null;

			document.designMode = 'on';

			if (command == 'normal' || command == 'bold' || command == 'italic' || command == 'underline') {
				if (document.queryCommandState('bold')) {
					document.execCommand('bold', false, value); // remove bold (modal)
				}
				if (document.queryCommandState('italic')) {
					document.execCommand('italic', false, value); // remove italic (component)
				}
				if (document.queryCommandState('underline')) {
					document.execCommand('underline', false, value); // remove underline (stacked)
				}
			}

			document.execCommand(command, false, value);
			document.designMode = 'off';

			self.render();
		}

		this.formatExpandCollapse = function() {
			// first convert all of the dots to carets if they have children
			$('#tree li').each(function() {
				$(this).removeClass('has_children');
				if ($(this).next('ol').length > 0) {
					$(this).addClass('has_children');
				} else {
					$(this).removeClass('has_children').removeClass('collapsed');
				}
			});
		}

		this.keyup = function(item, event) {
			var keyCode = event.which;
			switch (keyCode) {
				case 8:
					// delete
					self.formatExpandCollapse();
					return true;
					break;
				case 192:
					// tilde
					self.apply('outdent');
					self.formatExpandCollapse();
					break;
				case 13: 
					// return/enter
					self.formatExpandCollapse();
					self.render();
					return true;
					break;
				case 9: 
					// tab
					self.apply('indent');
					// editor_formatExpandCollapse();
					break;
				default: 
					return true;
					break;
			}
			return false;
		}

		this.toggleWidth = function() {
			if (self.expanded()) {
				self.expanded(false);
			} else {
				self.expanded(true);
			}
		};

		this.checkLocalstorage = function() {
			try {
				return 'localStorage' in window && window['localStorage'] !== null;
			} catch (e) {
				return false;
			}
		}

	}

	// This runs when the component is torn down. Put here any logic necessary to clean up,
	// for example cancelling setTimeouts or disposing Knockout subscriptions/computeds.
	Tree.prototype.dispose = function() { };

	return { viewModel: Tree, template: templateMarkup };

});
