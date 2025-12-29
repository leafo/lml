" Vim ftplugin file for LML (Leaf's Music Language)
" Language: LML
" Maintainer: leafo

if exists("b:did_ftplugin")
  finish
endif
let b:did_ftplugin = 1

" Set comment format for LML
setlocal commentstring=#\ %s
setlocal comments=:#

" Undo settings when switching filetypes
let b:undo_ftplugin = "setlocal commentstring< comments<"
